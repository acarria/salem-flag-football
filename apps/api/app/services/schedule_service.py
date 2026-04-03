"""
Schedule-related domain logic extracted from admin/schedule_management.py.

Public functions:
- calculate_team_standings(league_id, db) — standings from completed games
- get_available_time_slots_for_date(...) — merged non-conflicting windows
- generate_time_slots_from_availability(...) — discrete "HH:MM" slots
"""

import logging
from collections import defaultdict
from datetime import date, datetime, timedelta, time as dt_time
from itertools import groupby
from typing import Dict, List, Optional, Tuple
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.field import Field
from app.models.field_availability import FieldAvailability
from app.models.game import Game
from app.models.league_field import LeagueField

logger = logging.getLogger(__name__)

# Maximum game duration in minutes (60 minutes)
MAX_GAME_DURATION_MINUTES = 60


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _has_conflict(
    field_id: UUID,
    slot_start: dt_time,
    slot_end: dt_time,
    booked_by_field: Dict[UUID, List[Tuple[dt_time, dt_time]]],
) -> bool:
    """Return True if the proposed slot overlaps any existing booking for the field."""
    for booked_start, booked_end in booked_by_field.get(field_id, []):
        if not (slot_end <= booked_start or slot_start >= booked_end):
            return True
    return False


def _merge_field_slots(
    field_id: UUID,
    field_slots: List[Tuple[dt_time, dt_time]],
    merged: List[Tuple[UUID, dt_time, dt_time]],
) -> None:
    """Merge overlapping (start, end) tuples for one field into the merged list."""
    field_slots.sort(key=lambda x: x[0])
    for slot_start, slot_end in field_slots:
        if not merged or merged[-1][0] != field_id:
            merged.append((field_id, slot_start, slot_end))
        else:
            _, last_start, last_end = merged[-1]
            if slot_start <= last_end:
                merged[-1] = (field_id, last_start, max(slot_end, last_end))
            else:
                merged.append((field_id, slot_start, slot_end))


def _collect_non_conflicting(
    availabilities,
    target_date: date,
    max_duration_minutes: int,
    booked_by_field: Dict[UUID, List[Tuple[dt_time, dt_time]]],
) -> List[Tuple[UUID, dt_time, dt_time]]:
    """Filter availability windows to those that fit a game and have no booking conflicts."""
    result: List[Tuple[UUID, dt_time, dt_time]] = []
    for avail in availabilities:
        if avail.is_recurring:
            if avail.recurrence_start_date and target_date < avail.recurrence_start_date:
                continue
            if avail.recurrence_end_date and target_date > avail.recurrence_end_date:
                continue
        start_dt = datetime.combine(target_date, avail.start_time)
        end_dt = datetime.combine(target_date, avail.end_time)
        if (end_dt - start_dt).total_seconds() / 60 >= max_duration_minutes:
            if not _has_conflict(avail.field_id, avail.start_time, avail.end_time, booked_by_field):
                result.append((avail.field_id, avail.start_time, avail.end_time))
    return result


# ---------------------------------------------------------------------------
# Standings
# ---------------------------------------------------------------------------

def calculate_team_standings(league_id: UUID, db: Session) -> List[Tuple[UUID, Dict]]:
    """
    Calculate team standings from completed regular season games.

    Returns a sorted list of (team_id, stats_dict) tuples ranked by
    win percentage, wins, points for, and points against.
    """
    games = db.query(Game).filter(
        Game.league_id == league_id,
        Game.phase == 'regular_season',
        Game.status == 'completed',
        Game.is_active == True,
        Game.winner_id.isnot(None)
    ).all()

    team_stats: Dict = defaultdict(lambda: {
        'wins': 0, 'losses': 0, 'points_for': 0, 'points_against': 0,
    })

    for game in games:
        team1_score = game.team1_score or 0
        team2_score = game.team2_score or 0

        team_stats[game.team1_id]['points_for'] += team1_score
        team_stats[game.team1_id]['points_against'] += team2_score
        team_stats[game.team2_id]['points_for'] += team2_score
        team_stats[game.team2_id]['points_against'] += team1_score

        if game.winner_id == game.team1_id:
            team_stats[game.team1_id]['wins'] += 1
            team_stats[game.team2_id]['losses'] += 1
        elif game.winner_id == game.team2_id:
            team_stats[game.team2_id]['wins'] += 1
            team_stats[game.team1_id]['losses'] += 1

    standings = []
    for team_id, stats in team_stats.items():
        total_games = stats['wins'] + stats['losses']
        stats['win_percentage'] = stats['wins'] / total_games if total_games > 0 else 0.0
        standings.append((team_id, stats))

    standings.sort(key=lambda x: (
        -x[1]['win_percentage'],
        -x[1]['wins'],
        -x[1]['points_for'],
        x[1]['points_against']
    ))

    return standings


# ---------------------------------------------------------------------------
# Field availability
# ---------------------------------------------------------------------------

def get_available_time_slots_for_date(
    league_id: UUID,
    target_date: date,
    db: Session,
    field_id: Optional[UUID] = None,
    max_duration_minutes: int = MAX_GAME_DURATION_MINUTES,
) -> List[Tuple[UUID, dt_time, dt_time]]:
    """
    Get available time slots for a specific date based on field availability.

    Queries field availability for fields associated with the league and checks
    existing game bookings across ALL active leagues to avoid conflicts. Returns
    merged, non-conflicting time windows as (field_id, start_time, end_time) tuples.
    """
    # Get fields associated with this league
    league_field_ids_subquery = db.query(LeagueField.field_id).filter(
        LeagueField.league_id == league_id
    ).subquery()

    fields_query = db.query(Field.id).filter(
        Field.id.in_(select(league_field_ids_subquery.c.field_id)),
        Field.is_active == True
    )
    if field_id is not None:
        fields_query = fields_query.filter(Field.id == field_id)

    associated_field_ids = [fid[0] for fid in fields_query.all()]
    if not associated_field_ids:
        return []

    day_of_week = target_date.weekday()

    # Build dict of booked time slots indexed by field_id
    existing_games = db.query(Game).filter(
        Game.game_date == target_date,
        Game.field_id.in_(associated_field_ids),
        Game.is_active == True,
        Game.status.in_(['scheduled', 'in_progress']),
    ).all()

    booked_by_field: Dict[UUID, List[Tuple[dt_time, dt_time]]] = {}
    for game in existing_games:
        if game.field_id and game.game_time:
            game_start = datetime.strptime(game.game_time, "%H:%M").time()
            game_end_dt = datetime.combine(target_date, game_start) + timedelta(minutes=game.duration_minutes)
            booked_by_field.setdefault(game.field_id, []).append((game_start, game_end_dt.time()))

    # Recurring availability
    recurring_query = db.query(FieldAvailability).filter(
        FieldAvailability.field_id.in_(associated_field_ids),
        FieldAvailability.is_recurring == True,
        FieldAvailability.is_active == True,
        FieldAvailability.day_of_week == day_of_week,
    )
    if field_id is not None:
        recurring_query = recurring_query.filter(FieldAvailability.field_id == field_id)

    # Custom one-time availability
    custom_query = db.query(FieldAvailability).filter(
        FieldAvailability.field_id.in_(associated_field_ids),
        FieldAvailability.is_recurring == False,
        FieldAvailability.is_active == True,
        FieldAvailability.custom_date == target_date,
    )
    if field_id is not None:
        custom_query = custom_query.filter(FieldAvailability.field_id == field_id)

    # Collect non-conflicting availability windows
    available_slots = _collect_non_conflicting(recurring_query.all(), target_date, max_duration_minutes, booked_by_field)
    available_slots += _collect_non_conflicting(custom_query.all(), target_date, max_duration_minutes, booked_by_field)

    # Merge overlapping slots per field
    available_slots.sort(key=lambda x: (x[0], x[1]))
    merged_slots: List[Tuple[UUID, dt_time, dt_time]] = []
    for fid, group_iter in groupby(available_slots, key=lambda x: x[0]):
        _merge_field_slots(fid, [(s, e) for _, s, e in group_iter], merged_slots)

    return merged_slots


def generate_time_slots_from_availability(
    available_start: dt_time,
    available_end: dt_time,
    game_duration_minutes: int,
    buffer_minutes: int = 0
) -> List[str]:
    """Generate game time slots ("HH:MM") within an available time window."""
    actual_game_duration = min(game_duration_minutes, MAX_GAME_DURATION_MINUTES)
    slot_duration_minutes = actual_game_duration + buffer_minutes

    start_minutes = available_start.hour * 60 + available_start.minute
    end_minutes = available_end.hour * 60 + available_end.minute

    if end_minutes - start_minutes < actual_game_duration:
        return []

    slots = []
    current_minutes = start_minutes
    while current_minutes + actual_game_duration <= end_minutes:
        hours = current_minutes // 60
        minutes = current_minutes % 60
        slots.append(f"{hours:02d}:{minutes:02d}")
        current_minutes += slot_duration_minutes

    return slots
