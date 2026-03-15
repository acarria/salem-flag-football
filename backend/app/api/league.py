from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.db import get_db
from app.models.league import League
from app.models.player import Player
from app.models.team import Team
from app.models.game import Game
from app.models.league_player import LeaguePlayer
from app.api.schemas.league import PublicLeagueResponse
from app.services.league_service import get_player_cap, get_occupied_spots
from datetime import date
from typing import List
from uuid import UUID

router = APIRouter()

@router.get("/public/leagues", response_model=List[PublicLeagueResponse], summary="Get all leagues (public view)")
async def get_public_leagues(db: Session = Depends(get_db)):
    """Get all leagues with registration statistics for public viewing"""
    leagues = db.query(League).order_by(League.created_at.desc()).all()

    result = []
    for league in leagues:
        # Count confirmed players and teams
        player_count = db.query(LeaguePlayer).filter(
            LeaguePlayer.league_id == league.id,
            LeaguePlayer.registration_status == 'confirmed',
            LeaguePlayer.is_active == True
        ).count()

        team_count = db.query(Team).filter(
            Team.league_id == league.id,
            Team.is_active == True
        ).count()

        player_cap = get_player_cap(league.format, league.max_teams)
        occupied = get_occupied_spots(league.id, db)
        is_registration_open = (
            league.is_active
            and (league.registration_deadline is None or league.registration_deadline >= date.today())
            and (player_cap is None or occupied < player_cap)
        )
        spots_remaining = (player_cap - occupied) if player_cap is not None else None

        result.append(PublicLeagueResponse(
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
        ))

    return result

@router.get("/schedule", summary="Get league schedule")
async def get_schedule():
    # TODO: Fetch schedule from DB
    # For now, return sample data
    return [
        {"week": 1, "home": "Pumpkin Patriots", "away": "Salem Witches", "date": "2024-01-15", "time": "6:00 PM", "location": "Salem Common"},
        {"week": 2, "home": "Harbor Hawks", "away": "Downtown Dragons", "date": "2024-01-22", "time": "6:00 PM", "location": "Salem Common"},
        {"week": 3, "home": "Beach Brawlers", "away": "Forest Falcons", "date": "2024-01-29", "time": "6:00 PM", "location": "Salem Common"},
        {"week": 4, "home": "Pumpkin Patriots", "away": "Harbor Hawks", "date": "2024-02-05", "time": "6:00 PM", "location": "Salem Common"},
        {"week": 5, "home": "Salem Witches", "away": "Downtown Dragons", "date": "2024-02-12", "time": "6:00 PM", "location": "Salem Common"}
    ]

@router.get("/standings", summary="Get league standings")
async def get_standings():
    # TODO: Fetch standings from DB
    # For now, return sample data
    return [
        {"rank": 1, "team": "Pumpkin Patriots", "wins": 5, "losses": 0, "pointsFor": 120, "pointsAgainst": 45},
        {"rank": 2, "team": "Salem Witches", "wins": 4, "losses": 1, "pointsFor": 98, "pointsAgainst": 67},
        {"rank": 3, "team": "Harbor Hawks", "wins": 3, "losses": 2, "pointsFor": 87, "pointsAgainst": 78},
        {"rank": 4, "team": "Downtown Dragons", "wins": 2, "losses": 3, "pointsFor": 65, "pointsAgainst": 89},
        {"rank": 5, "team": "Beach Brawlers", "wins": 1, "losses": 4, "pointsFor": 45, "pointsAgainst": 102},
        {"rank": 6, "team": "Forest Falcons", "wins": 0, "losses": 5, "pointsFor": 23, "pointsAgainst": 115}
    ]

@router.get("/rules", summary="Get league rules")
async def get_rules():
    # TODO: Fetch rules from DB or static file
    return {"rules": "League rules go here."}

@router.get("/info", summary="Get general league info")
async def get_info():
    # TODO: Fetch general info from DB or static file
    return {"info": "General league info goes here."}

@router.get("/{league_id}/standings", summary="Get standings for a specific league")
async def get_league_standings(league_id: UUID, db: Session = Depends(get_db)):
    """Return real standings computed from completed game results for a league."""
    from app.api.admin.schedule_management import calculate_team_standings

    league = db.query(League).filter(League.id == league_id, League.is_active == True).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")

    standings = calculate_team_standings(league_id, db)

    result = []
    for rank, (team_id, stats) in enumerate(standings, 1):
        team = db.query(Team).filter(Team.id == team_id).first()
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
async def get_public_league_schedule(league_id: UUID, db: Session = Depends(get_db)):
    """Return the full schedule for a league, grouped by week."""
    league = db.query(League).filter(League.id == league_id, League.is_active == True).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")

    games = db.query(Game).filter(
        Game.league_id == league_id,
        Game.is_active == True
    ).order_by(Game.week, Game.game_datetime).all()

    schedule_by_week: dict = {}
    for game in games:
        week = game.week
        if week not in schedule_by_week:
            schedule_by_week[week] = []

        team1 = db.query(Team).filter(Team.id == game.team1_id).first()
        team2 = db.query(Team).filter(Team.id == game.team2_id).first()

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


@router.get("/active", summary="Get active leagues")
async def get_active_leagues(db: Session = Depends(get_db)):
    # Fetch active leagues from database
    active_leagues = db.query(League).filter(League.is_active == True).all()
    
    # For now, return sample data if no leagues in DB
    if not active_leagues:
        return [
            {
                "id": 1,
                "name": "Salem Flag Football League - Spring 2024",
                "start_date": "2024-03-15",
                "num_weeks": 8,
                "format": "7v7",
                "description": "Spring season flag football league in historic Salem, MA"
            },
            {
                "id": 2,
                "name": "Salem Flag Football League - Summer 2024",
                "start_date": "2024-06-15",
                "num_weeks": 10,
                "format": "7v7",
                "description": "Summer season flag football league with extended schedule"
            }
        ]
    
    return [
        {
            "id": league.id,
            "name": league.name,
            "start_date": league.start_date.isoformat(),
            "num_weeks": league.num_weeks,
            "format": league.format,
            "description": f"{league.format} format, {league.num_weeks} weeks starting {league.start_date.strftime('%B %d, %Y')}"
        }
        for league in active_leagues
    ] 