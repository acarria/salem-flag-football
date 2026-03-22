import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select
from datetime import datetime, date, timedelta, time as dt_time
from typing import List, Dict, Tuple, Optional
from uuid import UUID
from app.db.db import get_db
from app.models.league import League
from app.models.team import Team
from app.models.game import Game
from app.models.field import Field
from app.models.field_availability import FieldAvailability
from app.models.league_field import LeagueField
from app.api.schemas.admin import (
    ScheduleGenerationRequest, ScheduleGenerationResponse,
    GameUpdateRequest
)
from app.api.admin.dependencies import get_admin_user

logger = logging.getLogger(__name__)

router = APIRouter()

# Maximum game duration in minutes (60 minutes)
MAX_GAME_DURATION_MINUTES = 60

def calculate_team_standings(league_id: UUID, db: Session) -> List[Tuple[UUID, Dict]]:
    """
    Calculate team standings from completed regular season games.
    
    This function processes all completed regular season games for a league and
    calculates statistics for each team. Teams are ranked based on win percentage,
    total wins, points scored, and points allowed.
    
    Args:
        league_id: The unique identifier of the league to calculate standings for.
        db: SQLAlchemy database session for querying game data.
    
    Returns:
        A list of tuples, where each tuple contains:
            - team_id (int): The unique identifier of the team
            - stats_dict (Dict): A dictionary containing team statistics with keys:
                - wins (int): Total number of wins
                - losses (int): Total number of losses
                - points_for (int): Total points scored by the team
                - points_against (int): Total points scored against the team
                - win_percentage (float): Win percentage (wins / total_games)
        
        Teams are sorted by ranking (best first) using the following criteria:
        1. Win percentage (descending)
        2. Total wins (descending)
        3. Points scored (descending)
        4. Points allowed (ascending)
    
    Note:
        Only completed games with a winner are included in the calculations.
        Games must have phase='regular_season' and status='completed'.
    """
    # Get all completed regular season games
    games = db.query(Game).filter(
        Game.league_id == league_id,
        Game.phase == 'regular_season',
        Game.status == 'completed',
        Game.is_active == True,
        Game.winner_id.isnot(None)
    ).all()
    
    # Initialize team stats
    team_stats = {}
    
    # Process games to calculate stats
    for game in games:
        # Initialize if not seen
        if game.team1_id not in team_stats:
            team_stats[game.team1_id] = {
                'wins': 0,
                'losses': 0,
                'points_for': 0,
                'points_against': 0
            }
        if game.team2_id not in team_stats:
            team_stats[game.team2_id] = {
                'wins': 0,
                'losses': 0,
                'points_for': 0,
                'points_against': 0
            }
        
        # Add scores
        team1_score = game.team1_score or 0
        team2_score = game.team2_score or 0
        
        team_stats[game.team1_id]['points_for'] += team1_score
        team_stats[game.team1_id]['points_against'] += team2_score
        team_stats[game.team2_id]['points_for'] += team2_score
        team_stats[game.team2_id]['points_against'] += team1_score
        
        # Add win/loss
        if game.winner_id == game.team1_id:
            team_stats[game.team1_id]['wins'] += 1
            team_stats[game.team2_id]['losses'] += 1
        elif game.winner_id == game.team2_id:
            team_stats[game.team2_id]['wins'] += 1
            team_stats[game.team1_id]['losses'] += 1
    
    # Calculate win percentage and create sorted list
    standings = []
    for team_id, stats in team_stats.items():
        total_games = stats['wins'] + stats['losses']
        win_pct = stats['wins'] / total_games if total_games > 0 else 0.0
        stats['win_percentage'] = win_pct
        standings.append((team_id, stats))
    
    # Sort by: win percentage (desc), wins (desc), points_for (desc), points_against (asc)
    standings.sort(key=lambda x: (
        -x[1]['win_percentage'],
        -x[1]['wins'],
        -x[1]['points_for'],
        x[1]['points_against']
    ))
    
    return standings

def get_available_time_slots_for_date(league_id: UUID, target_date: date, db: Session, field_id: Optional[UUID] = None, max_duration_minutes: int = MAX_GAME_DURATION_MINUTES) -> List[Tuple[UUID, dt_time, dt_time]]:
    """
    Get available time slots for a specific date based on field availability.
    
    This function queries field availability for fields associated with the league
    and checks existing game bookings across ALL active leagues to avoid conflicts.
    Returns time slots available on the target date. Each slot is represented as
    a (field_id, start_time, end_time) tuple.
    
    Args:
        league_id: The unique identifier of the league.
        target_date: The date to check availability for.
        db: SQLAlchemy database session.
        field_id: Optional field ID to filter by specific field. If None, returns
                  availability for all fields associated with the league.
        max_duration_minutes: Maximum duration for a game slot (default: 60 minutes).
    
    Returns:
        A list of tuples, where each tuple contains:
            - field_id (int): The ID of the field
            - start_time (time): Start time of the available slot
            - end_time (time): End time of the available slot
        
        Slots are sorted by field_id, then by start time. Each slot represents
        a contiguous period of field availability that can accommodate at least
        one game of max_duration_minutes, after accounting for existing bookings
        across all active leagues.
    
    Note:
        - Gets fields associated with the league via league_fields junction table
        - For recurring availability, checks if target_date matches the day_of_week
          and falls within the recurrence_start_date and recurrence_end_date range.
        - For custom availability, checks if target_date matches custom_date.
        - Only active availability records are considered.
        - Checks existing games across ALL active leagues for conflicts
        - If field_id is provided, only returns availability for that field.
        - If no availability is found, returns an empty list.
    """
    # Get fields associated with this league
    league_field_ids_subquery = db.query(LeagueField.field_id).filter(
        LeagueField.league_id == league_id
    ).subquery()
    
    # Build base query for fields associated with the league
    fields_query = db.query(Field.id).filter(
        Field.id.in_(select(league_field_ids_subquery.c.field_id)),
        Field.is_active == True
    )
    
    if field_id is not None:
        fields_query = fields_query.filter(Field.id == field_id)
    
    associated_field_ids = [fid[0] for fid in fields_query.all()]
    
    if not associated_field_ids:
        return []  # No fields associated with this league
    
    available_slots = []
    day_of_week = target_date.weekday()  # 0=Monday, 6=Sunday
    
    # Get existing game bookings across ALL active leagues for this date
    # This ensures we don't double-book fields
    existing_games = db.query(Game).filter(
        Game.game_date == target_date,
        Game.field_id.in_(associated_field_ids),
        Game.is_active == True,
        Game.status.in_(['scheduled', 'in_progress'])  # Only count confirmed bookings
    ).all()
    
    # Build a set of booked time slots: (field_id, start_time, end_time)
    booked_slots = set()
    for game in existing_games:
        if game.field_id and game.game_time:
            game_start = datetime.strptime(game.game_time, "%H:%M").time()
            game_end_minutes = (game_start.hour * 60 + game_start.minute + game.duration_minutes)
            game_end_hours = game_end_minutes // 60
            game_end_mins = game_end_minutes % 60
            game_end = dt_time(game_end_hours, game_end_mins)
            booked_slots.add((game.field_id, game_start, game_end))
    
    # Build base query for recurring availability
    recurring_query = db.query(FieldAvailability).filter(
        FieldAvailability.field_id.in_(associated_field_ids),
        FieldAvailability.is_recurring == True,
        FieldAvailability.is_active == True,
        FieldAvailability.day_of_week == day_of_week
    )
    
    if field_id is not None:
        recurring_query = recurring_query.filter(FieldAvailability.field_id == field_id)
    
    recurring_availabilities = recurring_query.all()
    
    for avail in recurring_availabilities:
        # Check if target_date is within recurrence range
        if avail.recurrence_start_date and target_date < avail.recurrence_start_date:
            continue
        if avail.recurrence_end_date and target_date > avail.recurrence_end_date:
            continue
        
        # Check if the time window can fit at least one game
        start_dt = datetime.combine(target_date, avail.start_time)
        end_dt = datetime.combine(target_date, avail.end_time)
        duration_minutes = (end_dt - start_dt).total_seconds() / 60
        
        if duration_minutes >= max_duration_minutes:
            # Check if this slot conflicts with existing bookings
            slot_start = avail.start_time
            slot_end = avail.end_time
            conflicts = False
            
            for booked_field_id, booked_start, booked_end in booked_slots:
                if booked_field_id == avail.field_id:
                    # Check for overlap
                    if not (slot_end <= booked_start or slot_start >= booked_end):
                        conflicts = True
                        break
            
            if not conflicts:
                available_slots.append((avail.field_id, avail.start_time, avail.end_time))
    
    # Build base query for custom one-time availability
    custom_query = db.query(FieldAvailability).filter(
        FieldAvailability.field_id.in_(associated_field_ids),
        FieldAvailability.is_recurring == False,
        FieldAvailability.is_active == True,
        FieldAvailability.custom_date == target_date
    )
    
    if field_id is not None:
        custom_query = custom_query.filter(FieldAvailability.field_id == field_id)
    
    custom_availabilities = custom_query.all()
    
    for avail in custom_availabilities:
        # Check if the time window can fit at least one game
        start_dt = datetime.combine(target_date, avail.start_time)
        end_dt = datetime.combine(target_date, avail.end_time)
        duration_minutes = (end_dt - start_dt).total_seconds() / 60
        
        if duration_minutes >= max_duration_minutes:
            # Check if this slot conflicts with existing bookings
            slot_start = avail.start_time
            slot_end = avail.end_time
            conflicts = False
            
            for booked_field_id, booked_start, booked_end in booked_slots:
                if booked_field_id == avail.field_id:
                    # Check for overlap
                    if not (slot_end <= booked_start or slot_start >= booked_end):
                        conflicts = True
                        break
            
            if not conflicts:
                available_slots.append((avail.field_id, avail.start_time, avail.end_time))
    
    # Sort by field_id, then by start time
    available_slots.sort(key=lambda x: (x[0], x[1]))
    
    # Merge overlapping slots per field
    merged_slots = []
    current_field_id = None
    field_slots = []
    
    for field_id, start, end in available_slots:
        if current_field_id is None or field_id != current_field_id:
            # Process previous field's slots
            if field_slots:
                # Merge overlapping slots for previous field
                field_slots.sort(key=lambda x: x[0])
                for slot_start, slot_end in field_slots:
                    if not merged_slots or merged_slots[-1][0] != current_field_id:
                        merged_slots.append((current_field_id, slot_start, slot_end))
                    else:
                        last_field_id, last_start, last_end = merged_slots[-1]
                        if slot_start <= last_end:
                            merged_slots[-1] = (current_field_id, last_start, max(slot_end, last_end))
                        else:
                            merged_slots.append((current_field_id, slot_start, slot_end))
            
            # Start new field
            current_field_id = field_id
            field_slots = [(start, end)]
        else:
            field_slots.append((start, end))
    
    # Process last field's slots
    if field_slots:
        field_slots.sort(key=lambda x: x[0])
        for slot_start, slot_end in field_slots:
            if not merged_slots or merged_slots[-1][0] != current_field_id:
                merged_slots.append((current_field_id, slot_start, slot_end))
            else:
                last_field_id, last_start, last_end = merged_slots[-1]
                if slot_start <= last_end:
                    merged_slots[-1] = (current_field_id, last_start, max(slot_end, last_end))
                else:
                    merged_slots.append((current_field_id, slot_start, slot_end))
    
    return merged_slots

def generate_time_slots_from_availability(
    available_start: dt_time,
    available_end: dt_time,
    game_duration_minutes: int,
    buffer_minutes: int = 0
) -> List[str]:
    """
    Generate game time slots within an available time window.
    
    Creates time slots for games of a given duration within an available
    time window, optionally with buffer time between games.
    
    Args:
        available_start: Start time of the available window.
        available_end: End time of the available window.
        game_duration_minutes: Duration of each game in minutes (max 60).
        buffer_minutes: Buffer time between games in minutes (default: 0).
    
    Returns:
        A list of time strings in "HH:MM" format representing available
        game start times within the window.
    
    Note:
        - Game duration is capped at MAX_GAME_DURATION_MINUTES (60 minutes).
        - Time slots are generated at intervals of (game_duration + buffer_minutes).
        - Returns empty list if window is too short for even one game.
    """
    # Cap game duration at max
    actual_game_duration = min(game_duration_minutes, MAX_GAME_DURATION_MINUTES)
    
    # Calculate total time needed per game slot
    slot_duration_minutes = actual_game_duration + buffer_minutes
    
    # Convert times to minutes since midnight for calculation
    start_minutes = available_start.hour * 60 + available_start.minute
    end_minutes = available_end.hour * 60 + available_end.minute
    
    # Calculate how many slots fit
    window_duration = end_minutes - start_minutes
    if window_duration < actual_game_duration:
        return []  # Window too short
    
    slots = []
    current_minutes = start_minutes
    
    while current_minutes + actual_game_duration <= end_minutes:
        hours = current_minutes // 60
        minutes = current_minutes % 60
        slots.append(f"{hours:02d}:{minutes:02d}")
        current_minutes += slot_duration_minutes
    
    return slots

@router.post("/leagues/{league_id}/generate-schedule", response_model=ScheduleGenerationResponse, summary="Generate schedule for league")
async def generate_schedule(
    league_id: UUID,
    schedule_data: ScheduleGenerationRequest,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
):
    """
    Generate a complete schedule for a league based on its tournament format.
    
    This endpoint creates game schedules for leagues based on their configured
    tournament format.

    Supported tournament formats:
        - round_robin: Generates a complete round-robin schedule where each
          team plays every other team
        - swiss: Generates a round-robin schedule (swiss pairing not yet implemented)
    
    Args:
        league_id: The unique identifier of the league to generate a schedule for.
        schedule_data: ScheduleGenerationRequest containing optional scheduling
            parameters:
            - start_date: Optional start date (defaults to league.start_date)
            - game_duration: Optional game duration in minutes (defaults to league.game_duration)
            - time_slots: Optional list of time slots (defaults to ["18:00", "19:00", "20:00"])
        db: SQLAlchemy database session (dependency injection).
        admin_user: Authenticated admin user (dependency injection).
    
    Returns:
        ScheduleGenerationResponse containing:
            - games_created: Total number of games created
            - weeks_scheduled: Number of weeks scheduled
            - schedule_details: List of game details with week, date, time, teams, etc.
    
    Raises:
        HTTPException 404: If the league is not found.
        HTTPException 400: If there are fewer than 2 teams in the league.
        HTTPException 400: If an unsupported tournament format is used.
    
    Note:
        This function will deactivate all existing games for the league before
        generating the new schedule. All existing games will have is_active set to False.
        
        Field Availability:
        - If time_slots are provided in schedule_data, they will be used (backward compatibility).
        - If time_slots are not provided, the function will query FieldAvailability records
          to determine available time slots for each date.
        - Games are only scheduled on dates with field availability configured.
        - Weeks with no field availability will be skipped.
        
        Game Duration:
        - All games are capped at a maximum duration of 60 minutes.
        - If game_duration exceeds 60 minutes, it will be automatically reduced to 60 minutes.
    """
    # Verify league exists
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    
    # Get active teams for this league
    teams = db.query(Team).filter(
        Team.league_id == league_id,
        Team.is_active == True
    ).all()
    
    if len(teams) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 teams to generate a schedule")
    
    # Use provided data or league defaults
    start_date = schedule_data.start_date or league.start_date
    game_duration = schedule_data.game_duration or league.game_duration
    
    # Enforce maximum game duration of 60 minutes
    game_duration = min(game_duration, MAX_GAME_DURATION_MINUTES)
    
    # If time_slots are provided in request, use them (for backward compatibility)
    # Otherwise, we'll use field availability to determine time slots
    time_slots_provided = schedule_data.time_slots
    
    # Clear existing games for this league
    existing_games = db.query(Game).filter(Game.league_id == league_id).all()
    for game in existing_games:
        game.is_active = False
    
    # Generate schedule based on tournament format
    schedule_details = []
    games_created = 0
    current_date = start_date
    
    if league.tournament_format == 'round_robin':
        # Generate round-robin schedule
        team_ids = [team.id for team in teams]
        num_teams = len(team_ids)
        
        # If odd number of teams, add a "bye" team
        if num_teams % 2 == 1:
            team_ids.append(None)  # Bye team
            num_teams += 1
        
        # Generate round-robin pairings
        for week in range(league.num_weeks):
            # Rotate teams for round-robin
            if week > 0:
                # Keep first team fixed, rotate others
                team_ids = [team_ids[0]] + team_ids[2:] + [team_ids[1]]
            
            # Get available time slots for this date
            if time_slots_provided:
                # Use provided time slots (backward compatibility)
                available_time_slots = time_slots_provided
            else:
                # Get time slots from field availability
                available_windows = get_available_time_slots_for_date(league_id, current_date, db, field_id=None, max_duration_minutes=game_duration)
                available_time_slots = []
                for field_id, window_start, window_end in available_windows:
                    slots = generate_time_slots_from_availability(
                        window_start, window_end, game_duration, buffer_minutes=0
                    )
                    # Add field_id to each slot
                    for slot_time in slots:
                        available_time_slots.append((field_id, slot_time))
                
                if not available_time_slots:
                    # No availability for this date - skip to next week
                    current_date += timedelta(days=7)
                    continue
            
            # Create games for this week
            game_slot_index = 0
            for i in range(0, num_teams, 2):
                if team_ids[i] is not None and team_ids[i+1] is not None:
                    # Use available time slots, cycling through them
                    if game_slot_index >= len(available_time_slots):
                        # No more available slots for this date
                        break
                    
                    # Get field_id and time from slot
                    slot = available_time_slots[game_slot_index % len(available_time_slots)]
                    field_id_for_game = None
                    if isinstance(slot, tuple):
                        field_id_for_game, game_time = slot
                    else:
                        # Legacy format
                        game_time = slot
                    game_datetime = datetime.combine(current_date, datetime.strptime(game_time, "%H:%M").time())

                    # Create game in database
                    game = Game(
                        league_id=league_id,
                        team1_id=team_ids[i],
                        team2_id=team_ids[i+1],
                        week=week + 1,
                        game_date=current_date,
                        game_time=game_time,
                        game_datetime=game_datetime,
                        duration_minutes=game_duration,
                        field_id=field_id_for_game,
                        created_by=admin_user["id"]
                    )
                    db.add(game)

                    schedule_details.append({
                        "week": week + 1,
                        "date": current_date,
                        "time": game_time,
                        "team1_id": team_ids[i],
                        "team2_id": team_ids[i+1],
                        "game_datetime": game_datetime.isoformat(),
                        "duration_minutes": game_duration
                    })
                    games_created += 1
                    game_slot_index += 1

            current_date += timedelta(days=7)

    else:
        # For other formats (swiss, etc.), create a simple round-robin
        team_ids = [team.id for team in teams]
        for week in range(league.num_weeks):
            # Get available time slots for this date
            if time_slots_provided:
                # Use provided time slots (backward compatibility)
                available_time_slots = time_slots_provided
            else:
                # Get time slots from field availability
                available_windows = get_available_time_slots_for_date(league_id, current_date, db, field_id=None, max_duration_minutes=game_duration)
                available_time_slots = []
                for field_id, window_start, window_end in available_windows:
                    slots = generate_time_slots_from_availability(
                        window_start, window_end, game_duration, buffer_minutes=0
                    )
                    # Add field_id to each slot
                    for slot_time in slots:
                        available_time_slots.append((field_id, slot_time))

                if not available_time_slots:
                    # No availability for this date - skip to next week
                    current_date += timedelta(days=7)
                    continue

            # Create games for this week
            game_slot_index = 0
            for i in range(0, len(team_ids), 2):
                if i + 1 < len(team_ids):
                    # Use available time slots, cycling through them
                    if game_slot_index >= len(available_time_slots):
                        # No more available slots for this date
                        break

                    # Get field_id and time from slot
                    slot = available_time_slots[game_slot_index % len(available_time_slots)]
                    field_id_for_game = None
                    if isinstance(slot, tuple):
                        field_id_for_game, game_time = slot
                    else:
                        # Legacy format
                        game_time = slot
                    game_datetime = datetime.combine(current_date, datetime.strptime(game_time, "%H:%M").time())

                    # Create game in database
                    game = Game(
                        league_id=league_id,
                        team1_id=team_ids[i],
                        team2_id=team_ids[i+1],
                        week=week + 1,
                        game_date=current_date,
                        game_time=game_time,
                        game_datetime=game_datetime,
                        duration_minutes=game_duration,
                        field_id=field_id_for_game,
                        created_by=admin_user["id"]
                    )
                    db.add(game)

                    schedule_details.append({
                        "week": week + 1,
                        "date": current_date,
                        "time": game_time,
                        "team1_id": team_ids[i],
                        "team2_id": team_ids[i+1],
                        "game_datetime": game_datetime.isoformat(),
                        "duration_minutes": game_duration
                    })
                    games_created += 1
                    game_slot_index += 1

            current_date += timedelta(days=7)

    # Commit all changes
    db.commit()
    
    weeks_scheduled = league.num_weeks
    
    return ScheduleGenerationResponse(
        games_created=games_created,
        weeks_scheduled=weeks_scheduled,
        schedule_details=schedule_details
    )

@router.get("/leagues/{league_id}/schedule", summary="Get league schedule")
async def get_league_schedule(
    league_id: UUID,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
):
    """
    Retrieve the complete schedule for a league, organized by week.
    
    This endpoint fetches all active games for a league and organizes them
    by week. Each game includes detailed information such as teams, dates,
    times, scores, and status.
    
    Args:
        league_id: The unique identifier of the league to retrieve the schedule for.
        db: SQLAlchemy database session (dependency injection).
        admin_user: Authenticated admin user (dependency injection).
    
    Returns:
        A dictionary containing:
            - league_id: The unique identifier of the league
            - league_name: The name of the league
            - total_games: Total number of active games in the schedule
            - schedule_by_week: A dictionary where keys are week numbers and
              values are lists of game dictionaries, each containing:
                - game_id: Unique identifier of the game
                - team1_id: ID of the first team
                - team1_name: Name of the first team
                - team2_id: ID of the second team
                - team2_name: Name of the second team
                - date: Game date
                - time: Game time
                - datetime: ISO format datetime string
                - duration_minutes: Duration of the game in minutes
                - status: Current status of the game (scheduled, in_progress, completed, etc.)
                - phase: Tournament phase (regular_season, playoff_round_X, etc.)
                - team1_score: Score of team 1 (if available)
                - team2_score: Score of team 2 (if available)
                - winner_id: ID of the winning team (if game is completed)
    
    Raises:
        HTTPException 404: If the league is not found.
    
    Note:
        Only active games (is_active=True) are included in the results.
        Games are ordered by week number and then by game datetime.
    """
    # Verify league exists
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    
    # Get all active games for this league
    games = db.query(Game).filter(
        Game.league_id == league_id,
        Game.is_active == True
    ).order_by(Game.week, Game.game_datetime).all()
    
    # Batch-fetch all teams referenced by games to avoid N+1 queries
    all_team_ids = set()
    for game in games:
        if game.team1_id:
            all_team_ids.add(game.team1_id)
        if game.team2_id:
            all_team_ids.add(game.team2_id)
    teams_by_id = {t.id: t for t in db.query(Team).filter(Team.id.in_(all_team_ids)).all()} if all_team_ids else {}

    # Group games by week
    schedule_by_week = {}
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
async def update_game(
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

    # Update scores and auto-determine winner / status
    scores_provided = game_data.team1_score is not None and game_data.team2_score is not None
    if game_data.team1_score is not None:
        game.team1_score = game_data.team1_score
    if game_data.team2_score is not None:
        game.team2_score = game_data.team2_score

    if scores_provided:
        # Auto-determine winner unless explicitly overridden
        if game_data.winner_id is not None:
            game.winner_id = game_data.winner_id
        elif game_data.team1_score > game_data.team2_score:
            game.winner_id = game.team1_id
        elif game_data.team2_score > game_data.team1_score:
            game.winner_id = game.team2_id
        # Ties: winner_id stays None
        # Auto-complete unless a different status is explicitly set
        if game_data.status is None:
            game.status = 'completed'

    if game_data.winner_id is not None and not scores_provided:
        game.winner_id = game_data.winner_id

    if game_data.status is not None:
        game.status = game_data.status

    # Update scheduling details
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
