import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from datetime import datetime, date, timedelta, time as dt_time
from typing import List, Tuple, Optional
from uuid import UUID
from app.db.db import get_db
from app.models.league import League
from app.models.team import Team
from app.models.game import Game
from app.api.schemas.admin import (
    ScheduleGenerationRequest, ScheduleGenerationResponse,
    GameUpdateRequest
)
from app.api.admin.dependencies import get_admin_user
from app.core.limiter import limiter
from app.services.schedule_service import (
    get_available_time_slots_for_date,
    generate_time_slots_from_availability,
    MAX_GAME_DURATION_MINUTES,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_week_slots(
    league_id: UUID,
    current_date: date,
    db: Session,
    time_slots_provided: Optional[List[str]],
    game_duration: int,
) -> Optional[list]:
    """Return available time slots for a week-date, or None if no availability."""
    if time_slots_provided:
        return time_slots_provided
    available_windows = get_available_time_slots_for_date(
        league_id, current_date, db, field_id=None, max_duration_minutes=game_duration
    )
    available_time_slots: list = []
    for fid, window_start, window_end in available_windows:
        slots = generate_time_slots_from_availability(
            window_start, window_end, game_duration, buffer_minutes=0
        )
        for slot_time in slots:
            available_time_slots.append((fid, slot_time))
    return available_time_slots if available_time_slots else None


def _create_games_for_pairings(
    pairings: List[Tuple],
    week: int,
    current_date: date,
    available_time_slots: list,
    game_duration: int,
    league_id: UUID,
    admin_user_id: str,
    db: Session,
) -> Tuple[List[dict], int]:
    """Create Game records for a list of (team1_id, team2_id) pairings. Returns (details, count)."""
    details: List[dict] = []
    count = 0
    for idx, (t1, t2) in enumerate(pairings):
        if idx >= len(available_time_slots):
            break
        slot = available_time_slots[idx]
        field_id_for_game = None
        if isinstance(slot, tuple):
            field_id_for_game, game_time = slot
        else:
            game_time = slot
        game_datetime = datetime.combine(current_date, datetime.strptime(game_time, "%H:%M").time())

        game = Game(
            league_id=league_id,
            team1_id=t1,
            team2_id=t2,
            week=week,
            game_date=current_date,
            game_time=game_time,
            game_datetime=game_datetime,
            duration_minutes=game_duration,
            field_id=field_id_for_game,
            created_by=admin_user_id,
        )
        db.add(game)
        details.append({
            "week": week,
            "date": current_date,
            "time": game_time,
            "team1_id": t1,
            "team2_id": t2,
            "game_datetime": game_datetime.isoformat(),
            "duration_minutes": game_duration,
        })
        count += 1
    return details, count


# ---------------------------------------------------------------------------
# Schedule generation endpoint
# ---------------------------------------------------------------------------

@router.post("/leagues/{league_id}/generate-schedule", response_model=ScheduleGenerationResponse, summary="Generate schedule for league")
@limiter.limit("30/minute")
async def generate_schedule(
    request: Request,
    league_id: UUID,
    schedule_data: ScheduleGenerationRequest,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
):
    """Generate a complete schedule for a league based on its tournament format."""
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")

    teams = db.query(Team).filter(
        Team.league_id == league_id,
        Team.is_active == True
    ).all()
    if len(teams) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 teams to generate a schedule")

    start_date = schedule_data.start_date or league.start_date
    game_duration = min(schedule_data.game_duration or league.game_duration, MAX_GAME_DURATION_MINUTES)
    time_slots_provided = schedule_data.time_slots

    # Clear existing games
    for game in db.query(Game).filter(Game.league_id == league_id).all():
        game.is_active = False

    schedule_details: List[dict] = []
    games_created = 0
    current_date = start_date

    if league.tournament_format == 'round_robin':
        team_ids: list = [team.id for team in teams]
        num_teams = len(team_ids)
        if num_teams % 2 == 1:
            team_ids.append(None)
            num_teams += 1

        for week in range(league.num_weeks):
            if week > 0:
                team_ids = [team_ids[0]] + team_ids[2:] + [team_ids[1]]

            week_slots = _get_week_slots(league_id, current_date, db, time_slots_provided, game_duration)
            if week_slots is None:
                current_date += timedelta(days=7)
                continue

            pairings = [
                (team_ids[i], team_ids[i + 1])
                for i in range(0, num_teams, 2)
                if team_ids[i] is not None and team_ids[i + 1] is not None
            ]
            details, cnt = _create_games_for_pairings(
                pairings, week + 1, current_date, week_slots,
                game_duration, league_id, admin_user["id"], db,
            )
            schedule_details.extend(details)
            games_created += cnt
            current_date += timedelta(days=7)

    else:
        raise HTTPException(
            status_code=501,
            detail="Swiss tournament scheduling is not yet implemented",
        )

    db.commit()

    return ScheduleGenerationResponse(
        games_created=games_created,
        weeks_scheduled=league.num_weeks,
        schedule_details=schedule_details,
    )


# ---------------------------------------------------------------------------
# Schedule retrieval + game update endpoints
# ---------------------------------------------------------------------------

@router.get("/leagues/{league_id}/schedule", summary="Get league schedule")
@limiter.limit("30/minute")
async def get_league_schedule(
    request: Request,
    league_id: UUID,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
):
    """Retrieve the complete schedule for a league, organized by week."""
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")

    games = db.query(Game).filter(
        Game.league_id == league_id,
        Game.is_active == True
    ).order_by(Game.week, Game.game_datetime).all()

    all_team_ids = set()
    for game in games:
        if game.team1_id:
            all_team_ids.add(game.team1_id)
        if game.team2_id:
            all_team_ids.add(game.team2_id)
    teams_by_id = {t.id: t for t in db.query(Team).filter(Team.id.in_(all_team_ids)).all()} if all_team_ids else {}

    schedule_by_week: dict = {}
    for game in games:
        week = game.week
        if week not in schedule_by_week:
            schedule_by_week[week] = []

        team1 = teams_by_id.get(game.team1_id)
        team2 = teams_by_id.get(game.team2_id)

        schedule_by_week[week].append({
            "game_id": game.id,
            "team1_id": game.team1_id,
            "team1_name": team1.name if team1 else "TBD",
            "team2_id": game.team2_id,
            "team2_name": team2.name if team2 else "TBD",
            "date": game.game_date,
            "time": game.game_time,
            "datetime": game.game_datetime.isoformat(),
            "duration_minutes": game.duration_minutes,
            "status": game.status,
            "phase": game.phase,
            "team1_score": game.team1_score,
            "team2_score": game.team2_score,
            "winner_id": game.winner_id
        })

    return {
        "league_id": league_id,
        "league_name": league.name,
        "total_games": len(games),
        "schedule_by_week": schedule_by_week
    }

@router.put("/leagues/{league_id}/games/{game_id}", summary="Update a game's score or details")
@limiter.limit("30/minute")
async def update_game(
    request: Request,
    league_id: UUID,
    game_id: UUID,
    game_data: GameUpdateRequest,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
):
    """Update a game's score, status, or scheduling details (date/time/field)."""
    game = db.query(Game).filter(
        Game.id == game_id,
        Game.league_id == league_id,
        Game.is_active == True
    ).first()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    scores_provided = game_data.team1_score is not None and game_data.team2_score is not None
    if game_data.team1_score is not None:
        game.team1_score = game_data.team1_score
    if game_data.team2_score is not None:
        game.team2_score = game_data.team2_score

    if scores_provided:
        if game_data.winner_id is not None:
            game.winner_id = game_data.winner_id
        elif game_data.team1_score > game_data.team2_score:
            game.winner_id = game.team1_id
        elif game_data.team2_score > game_data.team1_score:
            game.winner_id = game.team2_id
        if game_data.status is None:
            game.status = 'completed'

    if game_data.winner_id is not None and not scores_provided:
        game.winner_id = game_data.winner_id

    if game_data.status is not None:
        game.status = game_data.status

    if game_data.game_date is not None or game_data.game_time is not None:
        new_date = game_data.game_date if game_data.game_date is not None else game.game_date
        new_time_str = game_data.game_time if game_data.game_time is not None else game.game_time
        hour, minute = map(int, new_time_str.split(':'))
        game.game_date = new_date
        game.game_time = new_time_str
        game.game_datetime = datetime.combine(new_date, dt_time(hour, minute))

    if game_data.field_id is not None:
        game.field_id = game_data.field_id

    try:
        db.commit()
        db.refresh(game)
        return {
            "message": "Game updated successfully",
            "game_id": str(game.id),
            "status": game.status,
            "team1_score": game.team1_score,
            "team2_score": game.team2_score,
            "winner_id": str(game.winner_id) if game.winner_id else None,
        }
    except Exception as e:
        db.rollback()
        logger.exception("Failed to update game: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")
