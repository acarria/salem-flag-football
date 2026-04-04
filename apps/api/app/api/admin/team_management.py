import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from app.core.limiter import limiter
from app.db.db import get_db
from app.models.league import League
from app.models.player import Player
from app.models.team import Team
from app.models.league_player import LeaguePlayer
from app.models.group import Group
from app.api.schemas.admin import (
    LeagueMemberResponse, TeamResponse, TeamGenerationRequest, TeamGenerationResponse
)
from app.api.admin.dependencies import get_admin_user
from app.services.team_generation_service import generate_teams as run_team_generation

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/leagues/{league_id}/members", response_model=List[LeagueMemberResponse], summary="Get all league members")
@limiter.limit("30/minute")
async def get_league_members(
    request: Request,
    league_id: UUID,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
):
    """Get all registered members for a specific league"""
    # Verify league exists
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")

    limit = min(limit, 500)
    # Get all league players with their details
    league_players = db.query(LeaguePlayer).filter(
        LeaguePlayer.league_id == league_id,
        LeaguePlayer.is_active == True
    ).offset(skip).limit(limit).all()

    player_ids = [lp.player_id for lp in league_players]
    group_ids  = [lp.group_id for lp in league_players if lp.group_id]
    team_ids   = [lp.team_id for lp in league_players if lp.team_id]

    players_by_id = {p.id: p for p in db.query(Player).filter(Player.id.in_(player_ids)).all()}
    groups_by_id  = {g.id: g for g in db.query(Group).filter(Group.id.in_(group_ids)).all()} if group_ids else {}
    teams_by_id   = {t.id: t for t in db.query(Team).filter(Team.id.in_(team_ids)).all()} if team_ids else {}

    result = []
    for lp in league_players:
        player = players_by_id.get(lp.player_id)
        if not player:
            continue
        group = groups_by_id.get(lp.group_id) if lp.group_id else None
        team  = teams_by_id.get(lp.team_id) if lp.team_id else None

        result.append(LeagueMemberResponse(
            id=lp.id,
            player_id=player.id,
            first_name=player.first_name,
            last_name=player.last_name,
            email=player.email,
            group_id=lp.group_id,
            group_name=group.name if group else None,
            team_id=lp.team_id,
            team_name=team.name if team else None,
            registration_status=lp.registration_status,
            payment_status=lp.payment_status,
            waiver_status=lp.waiver_status,
            created_at=lp.created_at
        ))

    return result

@router.get("/leagues/{league_id}/teams", response_model=List[TeamResponse], summary="Get all teams for a league")
@limiter.limit("30/minute")
async def get_league_teams(
    request: Request,
    league_id: UUID,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
):
    """Get all teams for a specific league"""
    # Verify league exists
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    
    # Get all teams for this league
    teams = db.query(Team).filter(
        Team.league_id == league_id,
        Team.is_active == True
    ).order_by(Team.name).all()
    
    return [TeamResponse.model_validate(team) for team in teams]

@router.post("/leagues/{league_id}/generate-teams", response_model=TeamGenerationResponse, summary="Generate teams for league")
@limiter.limit("30/minute")
async def generate_teams(
    request: Request,
    league_id: UUID,
    team_data: TeamGenerationRequest,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
):
    """Generate teams for a league, respecting group registrations when possible"""
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")

    # Check there are confirmed players
    confirmed_count = db.query(LeaguePlayer).filter(
        LeaguePlayer.league_id == league_id,
        LeaguePlayer.registration_status == 'confirmed',
        LeaguePlayer.is_active == True
    ).count()
    if confirmed_count == 0:
        raise HTTPException(status_code=400, detail="No confirmed players found for this league")

    try:
        result = run_team_generation(league, db, teams_count=team_data.teams_count)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.exception("Team generation failed for league %s: %s", league_id, e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")

    return TeamGenerationResponse(**result)

