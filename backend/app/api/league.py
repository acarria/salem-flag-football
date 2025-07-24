from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.db import get_db
from app.models.league import League
from datetime import date

router = APIRouter()

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