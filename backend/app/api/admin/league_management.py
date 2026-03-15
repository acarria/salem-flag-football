import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import date, timedelta
from uuid import UUID

logger = logging.getLogger(__name__)
from app.db.db import get_db
from app.models.league import League
from app.models.player import Player
from app.models.team import Team
from app.models.league_player import LeaguePlayer
from app.api.schemas.admin import (
    LeagueCreateRequest, LeagueUpdateRequest, LeagueResponse, LeagueStatsResponse
)
from app.api.admin.dependencies import get_admin_user

router = APIRouter()

def calculate_end_date(start_date: date, num_weeks: int, tournament_format: str,
                      regular_season_weeks: int = None) -> date:
    """Calculate the end date based on number of weeks"""
    end_date = start_date + timedelta(weeks=num_weeks - 1)
    return end_date

@router.post("/leagues", response_model=LeagueResponse, summary="Create a new league")
async def create_league(
    league_data: LeagueCreateRequest,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
):
    """Create a new league with flexible tournament format configuration"""
    
    # Calculate end date
    end_date = calculate_end_date(
        league_data.start_date,
        league_data.num_weeks,
        league_data.tournament_format,
        league_data.regular_season_weeks
    )
    
    # Validate tournament format specific settings
    if league_data.tournament_format == 'swiss':
        if not league_data.swiss_rounds:
            raise HTTPException(
                status_code=400, 
                detail="swiss_rounds is required for Swiss tournament format"
            )
    elif league_data.tournament_format == 'playoff_bracket':
        if not league_data.regular_season_weeks or not league_data.playoff_weeks:
            raise HTTPException(
                status_code=400,
                detail="regular_season_weeks and playoff_weeks are required for playoff bracket format"
            )
        if league_data.regular_season_weeks + league_data.playoff_weeks != league_data.num_weeks:
            raise HTTPException(
                status_code=400,
                detail="regular_season_weeks + playoff_weeks must equal num_weeks"
            )
    elif league_data.tournament_format == 'compass_draw':
        if not league_data.compass_draw_rounds:
            raise HTTPException(
                status_code=400,
                detail="compass_draw_rounds is required for compass draw format"
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
        regular_season_weeks=league_data.regular_season_weeks,
        playoff_weeks=league_data.playoff_weeks,
        swiss_rounds=league_data.swiss_rounds,
        swiss_pairing_method=league_data.swiss_pairing_method,
        compass_draw_rounds=league_data.compass_draw_rounds,
        playoff_teams=league_data.playoff_teams,
        playoff_format=league_data.playoff_format,
        game_duration=league_data.game_duration,
        games_per_week=league_data.games_per_week,
        max_teams=league_data.max_teams,
        min_teams=league_data.min_teams,
        registration_deadline=league_data.registration_deadline,
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
        except Exception:
            pass

        # Return with player/team counts
        return LeagueResponse(
            **league.__dict__,
            registered_players_count=0,
            registered_teams_count=0
        )
    except Exception as e:
        db.rollback()
        logger.exception("Failed to create league: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")

@router.get("/leagues", response_model=List[LeagueResponse], summary="Get all leagues (admin view)")
async def get_all_leagues(
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
):
    """Get all leagues with registration statistics"""
    leagues = db.query(League).order_by(League.created_at.desc()).all()
    
    result = []
    for league in leagues:
        # Count registered players and teams (using LeaguePlayer for many-to-many relationship)
        player_count = db.query(LeaguePlayer).filter(
            LeaguePlayer.league_id == league.id,
            LeaguePlayer.is_active == True
        ).count()
        
        team_count = db.query(Team).filter(
            Team.league_id == league.id,
            Team.is_active == True
        ).count()
        
        result.append(LeagueResponse(
            **league.__dict__,
            registered_players_count=player_count,
            registered_teams_count=team_count
        ))
    
    return result

@router.get("/leagues/{league_id}", response_model=LeagueResponse, summary="Get league details")
async def get_league_details(
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
        LeaguePlayer.registration_status == 'confirmed',
        LeaguePlayer.is_active == True
    ).count()

    team_count = db.query(Team).filter(
        Team.league_id == league.id,
        Team.is_active == True
    ).count()

    return LeagueResponse(
        **league.__dict__,
        registered_players_count=player_count,
        registered_teams_count=team_count
    )

@router.put("/leagues/{league_id}", response_model=LeagueResponse, summary="Update league")
async def update_league(
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
    update_data = league_data.dict(exclude_unset=True)
    
    # Recalculate end date if start_date or num_weeks changed
    if 'start_date' in update_data or 'num_weeks' in update_data:
        start_date = update_data.get('start_date', league.start_date)
        num_weeks = update_data.get('num_weeks', league.num_weeks)
        tournament_format = update_data.get('tournament_format', league.tournament_format)
        regular_season_weeks = update_data.get('regular_season_weeks', league.regular_season_weeks)
        
        update_data['end_date'] = calculate_end_date(
            start_date, num_weeks, tournament_format, regular_season_weeks
        )
    
    for field, value in update_data.items():
        setattr(league, field, value)
    
    try:
        db.commit()
        db.refresh(league)

        # Re-schedule deadline job with new deadline (if changed)
        try:
            from app.services.scheduler_service import schedule_deadline_job
            schedule_deadline_job(league.id, league.registration_deadline)
        except Exception:
            pass

        # Return with updated counts (using LeaguePlayer for many-to-many relationship)
        player_count = db.query(LeaguePlayer).filter(
            LeaguePlayer.league_id == league.id,
            LeaguePlayer.is_active == True
        ).count()

        team_count = db.query(Team).filter(
            Team.league_id == league.id,
            Team.is_active == True
        ).count()

        return LeagueResponse(
            **league.__dict__,
            registered_players_count=player_count,
            registered_teams_count=team_count
        )
    except Exception as e:
        db.rollback()
        logger.exception("Failed to update league: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")

@router.delete("/leagues/{league_id}", summary="Delete league")
async def delete_league(
    league_id: UUID,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
):
    """Delete a league and all associated data"""
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    
    try:
        # Soft delete by setting is_active to False
        league.is_active = False
        db.commit()
        return {"message": f"League '{league.name}' has been deleted"}
    except Exception as e:
        db.rollback()
        logger.exception("Failed to delete league: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")

@router.get("/leagues/{league_id}/stats", response_model=LeagueStatsResponse, summary="Get league statistics")
async def get_league_stats(
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
        LeaguePlayer.registration_status == 'confirmed',
        LeaguePlayer.is_active == True
    ).count()
    
    total_teams = db.query(Team).filter(
        Team.league_id == league.id,
        Team.is_active == True
    ).count()
    
    # Determine registration status
    if league.registration_deadline and date.today() > league.registration_deadline:
        registration_status = 'closed'
    elif league.max_teams and total_teams >= league.max_teams:
        registration_status = 'full'
    else:
        registration_status = 'open'
    
    # Calculate days until start and deadline
    days_until_start = (league.start_date - date.today()).days
    days_until_deadline = None
    if league.registration_deadline:
        days_until_deadline = (league.registration_deadline - date.today()).days
    
    return LeagueStatsResponse(
        league_id=league.id,
        total_players=total_players,
        total_teams=total_teams,
        registration_status=registration_status,
        days_until_start=days_until_start,
        days_until_deadline=days_until_deadline
    )
