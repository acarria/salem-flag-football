from datetime import datetime, timezone
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.limiter import limiter
from app.db.db import get_db
from app.models.group_invitation import GroupInvitation
from app.models.league import League
from app.models.league_player import LeaguePlayer
from app.models.player import Player
from app.models.team import Team
from app.models.game import Game
from app.api.schemas.league import PublicLeagueResponse
from app.services.league_service import get_player_cap
from app.utils.clerk_jwt import get_optional_user

router = APIRouter()


def _compute_league_response(
    league: League,
    confirmed_counts: dict,
    team_counts: dict,
    pending_invite_counts: dict,
    registered_league_ids: set | None = None,
) -> PublicLeagueResponse:
    """Build a PublicLeagueResponse from pre-fetched aggregate data."""
    player_count = confirmed_counts.get(league.id, 0)
    team_count   = team_counts.get(league.id, 0)
    # mirrors get_occupied_spots: confirmed + non-expired pending invites
    occupied     = player_count + pending_invite_counts.get(league.id, 0)
    player_cap   = get_player_cap(league.format, league.max_teams)
    is_registration_open = (
        league.is_active
        and (league.registration_deadline is None or league.registration_deadline >= datetime.now(timezone.utc).date())
        and (player_cap is None or occupied < player_cap)
    )
    spots_remaining = (player_cap - occupied) if player_cap is not None else None

    is_registered = None if registered_league_ids is None else (league.id in registered_league_ids)

    return PublicLeagueResponse(
        id=league.id,
        name=league.name,
        description=league.description,
        start_date=league.start_date.isoformat(),
        end_date=league.end_date.isoformat() if league.end_date else None,
        num_weeks=league.num_weeks,
        format=league.format,
        tournament_format=league.tournament_format,
        game_duration=league.game_duration,
        games_per_week=league.games_per_week,
        max_teams=league.max_teams,
        min_teams=league.min_teams,
        registration_deadline=league.registration_deadline.isoformat() if league.registration_deadline else None,
        registration_fee=league.registration_fee,
        is_active=league.is_active,
        registered_players_count=player_count,
        registered_teams_count=team_count,
        is_registration_open=is_registration_open,
        player_cap=player_cap,
        spots_remaining=spots_remaining,
        is_registered=is_registered,
    )


@router.get("/public/leagues", response_model=List[PublicLeagueResponse], summary="Get all leagues (public view)")
@limiter.limit("60/minute")
async def get_public_leagues(
    request: Request,
    skip: int = 0,
    limit: int = Query(default=50, le=100),
    db: Session = Depends(get_db),
    user: dict | None = Depends(get_optional_user),
):
    """Get all leagues with registration statistics for public viewing"""
    limit = min(limit, 100)
    leagues = db.query(League).order_by(League.created_at.desc()).offset(skip).limit(limit).all()
    if not leagues:
        return []

    league_ids = [le.id for le in leagues]
    now = datetime.now(timezone.utc)

    # Batch all count queries — one query each instead of N per league
    confirmed_counts = dict(
        db.query(LeaguePlayer.league_id, func.count(LeaguePlayer.id))
        .filter(
            LeaguePlayer.league_id.in_(league_ids),
            LeaguePlayer.registration_status == 'confirmed',
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
    pending_invite_counts = dict(
        db.query(GroupInvitation.league_id, func.count(GroupInvitation.id))
        .filter(
            GroupInvitation.league_id.in_(league_ids),
            GroupInvitation.status == 'pending',
            GroupInvitation.expires_at > now,
        )
        .group_by(GroupInvitation.league_id)
        .all()
    )

    # Optionally fold per-user registration state into the response
    registered_league_ids: set | None = None
    if user:
        player = db.query(Player).filter(Player.clerk_user_id == user["id"]).first()
        if player:
            registered_league_ids = set(
                row[0] for row in db.query(LeaguePlayer.league_id)
                .filter(
                    LeaguePlayer.player_id == player.id,
                    LeaguePlayer.registration_status == 'confirmed',
                    LeaguePlayer.is_active == True,
                )
                .all()
            )
        else:
            registered_league_ids = set()

    return [
        _compute_league_response(league, confirmed_counts, team_counts, pending_invite_counts, registered_league_ids)
        for league in leagues
    ]


@router.get("/{league_id}/standings", summary="Get standings for a specific league")
@limiter.limit("60/minute")
async def get_league_standings(request: Request, league_id: UUID, db: Session = Depends(get_db)):
    """Return real standings computed from completed game results for a league."""
    from app.services.schedule_service import calculate_team_standings

    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")

    standings = calculate_team_standings(league_id, db)

    team_ids = [team_id for team_id, _ in standings]
    teams_by_id = {t.id: t for t in db.query(Team).filter(Team.id.in_(team_ids)).all()}

    result = []
    for rank, (team_id, stats) in enumerate(standings, 1):
        team = teams_by_id.get(team_id)
        result.append({
            "rank": rank,
            "team_id": str(team_id),
            "team_name": team.name if team else "Unknown",
            "wins": stats["wins"],
            "losses": stats["losses"],
            "points_for": stats["points_for"],
            "points_against": stats["points_against"],
            "win_percentage": round(stats["win_percentage"], 3),
        })

    return result


@router.get("/{league_id}/schedule", summary="Get schedule for a specific league")
@limiter.limit("60/minute")
async def get_public_league_schedule(request: Request, league_id: UUID, db: Session = Depends(get_db)):
    """Return the full schedule for a league, grouped by week."""
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")

    games = db.query(Game).filter(
        Game.league_id == league_id,
        Game.is_active == True
    ).order_by(Game.week, Game.game_datetime).all()

    team_ids = {g.team1_id for g in games} | {g.team2_id for g in games}
    teams_by_id = {t.id: t for t in db.query(Team).filter(Team.id.in_(team_ids)).all()}

    schedule_by_week: dict = {}
    for game in games:
        week = game.week
        if week not in schedule_by_week:
            schedule_by_week[week] = []

        team1 = teams_by_id.get(game.team1_id)
        team2 = teams_by_id.get(game.team2_id)

        schedule_by_week[week].append({
            "game_id": str(game.id),
            "team1_id": str(game.team1_id),
            "team1_name": team1.name if team1 else "TBD",
            "team2_id": str(game.team2_id),
            "team2_name": team2.name if team2 else "TBD",
            "date": game.game_date.isoformat(),
            "time": game.game_time,
            "status": game.status,
            "phase": game.phase,
            "team1_score": game.team1_score,
            "team2_score": game.team2_score,
            "winner_id": str(game.winner_id) if game.winner_id else None,
        })

    return {
        "league_id": str(league_id),
        "league_name": league.name,
        "total_games": len(games),
        "schedule_by_week": schedule_by_week,
    }


@router.get("/{league_id}", response_model=PublicLeagueResponse, summary="Get a single league (public view)")
@limiter.limit("60/minute")
async def get_league_by_id(
    request: Request,
    league_id: UUID,
    db: Session = Depends(get_db),
    user: dict | None = Depends(get_optional_user),
):
    """Get a single league by ID. Does not filter by is_active — past leagues remain viewable."""
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")

    now = datetime.now(timezone.utc)

    confirmed_count = db.query(func.count(LeaguePlayer.id)).filter(
        LeaguePlayer.league_id == league_id,
        LeaguePlayer.registration_status == 'confirmed',
        LeaguePlayer.is_active == True,
    ).scalar() or 0

    team_count = db.query(func.count(Team.id)).filter(
        Team.league_id == league_id, Team.is_active == True,
    ).scalar() or 0

    pending_invite_count = db.query(func.count(GroupInvitation.id)).filter(
        GroupInvitation.league_id == league_id,
        GroupInvitation.status == 'pending',
        GroupInvitation.expires_at > now,
    ).scalar() or 0

    confirmed_counts = {league_id: confirmed_count}
    team_counts = {league_id: team_count}
    pending_invite_counts = {league_id: pending_invite_count}

    registered_league_ids: set | None = None
    if user:
        player = db.query(Player).filter(Player.clerk_user_id == user["id"]).first()
        if player:
            lp = db.query(LeaguePlayer).filter(
                LeaguePlayer.player_id == player.id,
                LeaguePlayer.league_id == league_id,
                LeaguePlayer.registration_status == 'confirmed',
                LeaguePlayer.is_active == True,
            ).first()
            registered_league_ids = {league_id} if lp else set()
        else:
            registered_league_ids = set()

    return _compute_league_response(league, confirmed_counts, team_counts, pending_invite_counts, registered_league_ids)
