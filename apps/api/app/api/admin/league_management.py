import logging

from datetime import date, datetime, timedelta, timezone
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.limiter import limiter

logger = logging.getLogger(__name__)
from app.db.db import get_db
from app.models.game import Game
from app.models.group import Group
from app.models.group_invitation import GroupInvitation
from app.models.league import League
from app.models.team import Team
from app.models.league_player import LeaguePlayer
from app.api.schemas.admin import (
    LeagueCreateRequest, LeagueUpdateRequest, LeagueResponse, LeagueStatsResponse
)
from app.api.schemas.common import SuccessResponse
from app.api.admin.dependencies import get_admin_user
from app.services.league_service import get_player_cap, get_occupied_spots
from app.core.config import settings as app_settings
from app.core.constants import INVITE_EXPIRED, INVITE_PENDING, REG_CONFIRMED

router = APIRouter()


def _league_response(league, player_count: int, team_count: int) -> LeagueResponse:
    """Build LeagueResponse from an ORM object + computed counts."""
    data = {c.name: getattr(league, c.name) for c in league.__table__.columns}
    data["registered_players_count"] = player_count
    data["registered_teams_count"] = team_count
    return LeagueResponse(**data)


def calculate_end_date(start_date: date, num_weeks: int) -> date:
    """Calculate the end date based on number of weeks"""
    end_date = start_date + timedelta(weeks=num_weeks - 1)
    return end_date

@router.post("/leagues", response_model=LeagueResponse, summary="Create a new league")
@limiter.limit("30/minute")
async def create_league(
    request: Request,
    league_data: LeagueCreateRequest,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
):
    """Create a new league with flexible tournament format configuration"""
    
    # Calculate end date
    end_date = calculate_end_date(
        league_data.start_date,
        league_data.num_weeks
    )
    
    # Validate tournament format specific settings
    if league_data.tournament_format == 'swiss':
        # Default swiss_rounds to num_weeks if not provided
        if not league_data.swiss_rounds:
            league_data.swiss_rounds = league_data.num_weeks
    
    # Auto-calculate registration deadline: start_date - (WAIVER_EXPIRY_DAYS + 1)
    registration_deadline = league_data.start_date - timedelta(
        days=app_settings.WAIVER_EXPIRY_DAYS + 1
    )

    # Create the league
    league = League(
        name=league_data.name,
        description=league_data.description,
        start_date=league_data.start_date,
        end_date=end_date,
        num_weeks=league_data.num_weeks,
        format=league_data.format,
        tournament_format=league_data.tournament_format,
        swiss_rounds=league_data.swiss_rounds,
        swiss_pairing_method=league_data.swiss_pairing_method,
        game_duration=league_data.game_duration,
        games_per_week=league_data.games_per_week,
        max_teams=league_data.max_teams,
        min_teams=league_data.min_teams,
        registration_deadline=registration_deadline,
        registration_fee=league_data.registration_fee,
        settings=league_data.settings,
        created_by=admin_user["id"]
    )
    
    try:
        db.add(league)
        db.commit()
        db.refresh(league)

        # Schedule deadline job if applicable
        try:
            from app.services.scheduler_service import schedule_deadline_job
            schedule_deadline_job(league.id, league.registration_deadline)
        except Exception as e:
            logger.warning("Failed to schedule deadline job for league %s: %s", league.id, e)

        # Return with player/team counts
        return _league_response(league, 0, 0)
    except Exception as e:
        db.rollback()
        logger.exception("Failed to create league: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")

@router.get("/leagues", response_model=List[LeagueResponse], summary="Get all leagues (admin view)")
@limiter.limit("30/minute")
async def get_all_leagues(
    request: Request,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, le=100),
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
):
    """Get all leagues with registration statistics"""
    limit = min(limit, 100)
    leagues = db.query(League).order_by(League.created_at.desc()).offset(skip).limit(limit).all()
    if not leagues:
        return []

    league_ids = [le.id for le in leagues]

    player_counts = dict(
        db.query(LeaguePlayer.league_id, func.count(LeaguePlayer.id))
        .filter(
            LeaguePlayer.league_id.in_(league_ids),
            LeaguePlayer.registration_status == REG_CONFIRMED,
            LeaguePlayer.is_active == True,
        )
        .group_by(LeaguePlayer.league_id)
        .all()
    )
    team_counts = dict(
        db.query(Team.league_id, func.count(Team.id))
        .filter(Team.league_id.in_(league_ids), Team.is_active == True)
        .group_by(Team.league_id)
        .all()
    )

    return [
        _league_response(league, player_counts.get(league.id, 0), team_counts.get(league.id, 0))
        for league in leagues
    ]

@router.get("/leagues/{league_id}", response_model=LeagueResponse, summary="Get league details")
@limiter.limit("30/minute")
async def get_league_details(
    request: Request,
    league_id: UUID,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
):
    """Get detailed information about a specific league"""
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    
    # Count registered players and teams (using LeaguePlayer for many-to-many relationship)
    player_count = db.query(LeaguePlayer).filter(
        LeaguePlayer.league_id == league.id,
        LeaguePlayer.registration_status == REG_CONFIRMED,
        LeaguePlayer.is_active == True
    ).count()

    team_count = db.query(Team).filter(
        Team.league_id == league.id,
        Team.is_active == True
    ).count()

    return _league_response(league, player_count, team_count)

@router.put("/leagues/{league_id}", response_model=LeagueResponse, summary="Update league")
@limiter.limit("30/minute")
async def update_league(
    request: Request,
    league_id: UUID,
    league_data: LeagueUpdateRequest,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
):
    """Update league settings"""
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    
    # Update fields
    update_data = league_data.model_dump(exclude_unset=True)
    
    # Recalculate end date if start_date or num_weeks changed
    if 'start_date' in update_data or 'num_weeks' in update_data:
        start_date = update_data.get('start_date', league.start_date)
        num_weeks = update_data.get('num_weeks', league.num_weeks)
        update_data['end_date'] = calculate_end_date(start_date, num_weeks)

    # Recalculate registration deadline if start_date changed
    if 'start_date' in update_data:
        start_date = update_data['start_date']
        update_data['registration_deadline'] = start_date - timedelta(
            days=app_settings.WAIVER_EXPIRY_DAYS + 1
        )
    
    _UPDATABLE_LEAGUE_FIELDS = {
        "name", "description", "start_date", "end_date", "num_weeks", "format",
        "tournament_format", "swiss_rounds", "swiss_pairing_method",
        "game_duration", "games_per_week", "max_teams", "min_teams",
        "registration_fee", "registration_deadline", "settings",
    }
    for field, value in update_data.items():
        if field in _UPDATABLE_LEAGUE_FIELDS:
            setattr(league, field, value)
    
    try:
        db.commit()
        db.refresh(league)

        # Re-schedule deadline job with new deadline (if changed)
        try:
            from app.services.scheduler_service import schedule_deadline_job
            schedule_deadline_job(league.id, league.registration_deadline)
        except Exception as e:
            logger.warning("Failed to reschedule deadline job for league %s: %s", league.id, e)

        # Return with updated counts (using LeaguePlayer for many-to-many relationship)
        player_count = db.query(LeaguePlayer).filter(
            LeaguePlayer.league_id == league.id,
            LeaguePlayer.registration_status == REG_CONFIRMED,
            LeaguePlayer.is_active == True
        ).count()

        team_count = db.query(Team).filter(
            Team.league_id == league.id,
            Team.is_active == True
        ).count()

        return _league_response(league, player_count, team_count)
    except Exception as e:
        db.rollback()
        logger.exception("Failed to update league: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")

@router.delete("/leagues/{league_id}", response_model=SuccessResponse, summary="Delete league")
@limiter.limit("30/minute")
async def delete_league(
    request: Request,
    league_id: UUID,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
):
    """Delete a league and all associated data"""
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    
    try:
        # Soft delete league and cascade to all child records
        league.is_active = False

        db.query(LeaguePlayer).filter(
            LeaguePlayer.league_id == league_id,
            LeaguePlayer.is_active == True,
        ).update({"is_active": False}, synchronize_session="fetch")

        db.query(Team).filter(
            Team.league_id == league_id,
            Team.is_active == True,
        ).update({"is_active": False}, synchronize_session="fetch")

        db.query(Game).filter(
            Game.league_id == league_id,
            Game.is_active == True,
        ).update({"is_active": False}, synchronize_session="fetch")

        db.query(Group).filter(
            Group.league_id == league_id,
            Group.is_active == True,
        ).update({"is_active": False}, synchronize_session="fetch")

        db.query(GroupInvitation).filter(
            GroupInvitation.league_id == league_id,
            GroupInvitation.status == INVITE_PENDING,
        ).update({"status": INVITE_EXPIRED}, synchronize_session="fetch")

        db.commit()
        return SuccessResponse(success=True, message=f"League '{league.name}' has been deleted")
    except Exception as e:
        db.rollback()
        logger.exception("Failed to delete league: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")

@router.get("/leagues/{league_id}/stats", response_model=LeagueStatsResponse, summary="Get league statistics")
@limiter.limit("30/minute")
async def get_league_stats(
    request: Request,
    league_id: UUID,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
):
    """Get comprehensive statistics for a league"""
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    
    # Count players and teams (using LeaguePlayer for many-to-many relationship)
    total_players = db.query(LeaguePlayer).filter(
        LeaguePlayer.league_id == league.id,
        LeaguePlayer.registration_status == REG_CONFIRMED,
        LeaguePlayer.is_active == True
    ).count()
    
    total_teams = db.query(Team).filter(
        Team.league_id == league.id,
        Team.is_active == True
    ).count()
    
    # Determine registration status (consistent with public league endpoint)
    today = datetime.now(timezone.utc).date()
    if league.registration_deadline and today > league.registration_deadline:
        registration_status = 'closed'
    else:
        player_cap = get_player_cap(league.format, league.max_teams)
        if player_cap is not None:
            occupied = get_occupied_spots(league.id, db)
            registration_status = 'full' if occupied >= player_cap else 'open'
        else:
            registration_status = 'open'
    
    # Calculate days until start and deadline
    days_until_start = (league.start_date - today).days
    days_until_deadline = None
    if league.registration_deadline:
        days_until_deadline = (league.registration_deadline - today).days
    
    return LeagueStatsResponse(
        league_id=league.id,
        total_players=total_players,
        total_teams=total_teams,
        registration_status=registration_status,
        days_until_start=days_until_start,
        days_until_deadline=days_until_deadline
    )
