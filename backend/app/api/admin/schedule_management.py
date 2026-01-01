from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, date, timedelta
from app.db.db import get_db
from app.models.league import League
from app.models.team import Team
from app.models.game import Game
from app.api.schemas.admin import (
    ScheduleGenerationRequest, ScheduleGenerationResponse
)
from app.api.admin.dependencies import get_admin_user

router = APIRouter()

@router.post("/leagues/{league_id}/generate-schedule", response_model=ScheduleGenerationResponse, summary="Generate schedule for league")
async def generate_schedule(
    league_id: int,
    schedule_data: ScheduleGenerationRequest,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
):
    """Generate a schedule for the league based on tournament format"""
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
    games_per_week = schedule_data.games_per_week or league.games_per_week
    time_slots = schedule_data.time_slots or ["18:00", "19:00", "20:00"]
    
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
            week_games = []
            
            # Rotate teams for round-robin
            if week > 0:
                # Keep first team fixed, rotate others
                team_ids = [team_ids[0]] + team_ids[2:] + [team_ids[1]]
            
            # Create games for this week
            for i in range(0, num_teams, 2):
                if team_ids[i] is not None and team_ids[i+1] is not None:
                    game_time = time_slots[i // 2 % len(time_slots)]
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
            
            current_date += timedelta(days=7)
    
    elif league.tournament_format == 'playoff_bracket':
        # Generate playoff bracket schedule
        if not league.regular_season_weeks or not league.playoff_weeks:
            raise HTTPException(status_code=400, detail="Playoff bracket requires regular_season_weeks and playoff_weeks")
        
        # Regular season (round-robin)
        team_ids = [team.id for team in teams]
        num_teams = len(team_ids)
        
        if num_teams % 2 == 1:
            team_ids.append(None)
            num_teams += 1
        
        for week in range(league.regular_season_weeks):
            week_games = []
            
            if week > 0:
                team_ids = [team_ids[0]] + team_ids[2:] + [team_ids[1]]
            
            for i in range(0, num_teams, 2):
                if team_ids[i] is not None and team_ids[i+1] is not None:
                    game_time = time_slots[i // 2 % len(time_slots)]
                    game_datetime = datetime.combine(current_date, datetime.strptime(game_time, "%H:%M").time())
                    
                    # Create game in database
                    game = Game(
                        league_id=league_id,
                        team1_id=team_ids[i],
                        team2_id=team_ids[i+1],
                        week=week + 1,
                        phase="regular_season",
                        game_date=current_date,
                        game_time=game_time,
                        game_datetime=game_datetime,
                        duration_minutes=game_duration,
                        created_by=admin_user["id"]
                    )
                    db.add(game)
                    
                    schedule_details.append({
                        "week": week + 1,
                        "phase": "regular_season",
                        "date": current_date,
                        "time": game_time,
                        "team1_id": team_ids[i],
                        "team2_id": team_ids[i+1],
                        "game_datetime": game_datetime.isoformat(),
                        "duration_minutes": game_duration
                    })
                    games_created += 1
            
            current_date += timedelta(days=7)
        
        # Playoff bracket
        playoff_teams = league.playoff_teams or min(8, len(teams))
        for week in range(league.playoff_weeks):
            week_games = []
            
            # Simple bracket generation (this could be more sophisticated)
            for i in range(0, playoff_teams, 2):
                if i + 1 < playoff_teams:
                    game_time = time_slots[i // 2 % len(time_slots)]
                    game_datetime = datetime.combine(current_date, datetime.strptime(game_time, "%H:%M").time())
                    
                    # Create game in database
                    game = Game(
                        league_id=league_id,
                        team1_id=team_ids[i] if i < len(team_ids) else None,
                        team2_id=team_ids[i+1] if i+1 < len(team_ids) else None,
                        week=league.regular_season_weeks + week + 1,
                        phase="playoff",
                        game_date=current_date,
                        game_time=game_time,
                        game_datetime=game_datetime,
                        duration_minutes=game_duration,
                        created_by=admin_user["id"]
                    )
                    db.add(game)
                    
                    schedule_details.append({
                        "week": league.regular_season_weeks + week + 1,
                        "phase": "playoff",
                        "date": current_date,
                        "time": game_time,
                        "team1_id": team_ids[i] if i < len(team_ids) else None,
                        "team2_id": team_ids[i+1] if i+1 < len(team_ids) else None,
                        "game_datetime": game_datetime.isoformat(),
                        "duration_minutes": game_duration
                    })
                    games_created += 1
            
            current_date += timedelta(days=7)
    
    else:
        # For other formats, create a simple round-robin
        team_ids = [team.id for team in teams]
        for week in range(league.num_weeks):
            for i in range(0, len(team_ids), 2):
                if i + 1 < len(team_ids):
                    game_time = time_slots[i // 2 % len(time_slots)]
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
            
            current_date += timedelta(days=7)
    
    # Commit all changes
    db.commit()
    
    return ScheduleGenerationResponse(
        games_created=games_created,
        weeks_scheduled=league.num_weeks,
        schedule_details=schedule_details
    )

@router.get("/leagues/{league_id}/schedule", summary="Get league schedule")
async def get_league_schedule(
    league_id: int,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
):
    """Get the generated schedule for a league"""
    # Verify league exists
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    
    # Get all active games for this league
    games = db.query(Game).filter(
        Game.league_id == league_id,
        Game.is_active == True
    ).order_by(Game.week, Game.game_datetime).all()
    
    # Group games by week
    schedule_by_week = {}
    for game in games:
        week = game.week
        if week not in schedule_by_week:
            schedule_by_week[week] = []
        
        # Get team names
        team1 = db.query(Team).filter(Team.id == game.team1_id).first()
        team2 = db.query(Team).filter(Team.id == game.team2_id).first()
        
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
