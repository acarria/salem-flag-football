from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, date, timedelta
from pydantic import BaseModel, validator
from app.db.db import get_db
from app.models.league import League
from app.models.player import Player
from app.models.team import Team
from app.models.admin_config import AdminConfig
from app.utils.clerk_jwt import get_current_user
from app.services.admin_service import AdminService

router = APIRouter(prefix="/admin", tags=["admin"])

# Pydantic models for request/response
class LeagueCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    start_date: date
    num_weeks: int
    format: str  # '7v7', '5v5', '4v4', etc.
    tournament_format: str = 'round_robin'  # 'round_robin', 'swiss', 'playoff_bracket', 'compass_draw'
    
    # Regular season settings (for playoff bracket format)
    regular_season_weeks: Optional[int] = None
    playoff_weeks: Optional[int] = None
    
    # Swiss tournament settings
    swiss_rounds: Optional[int] = None
    swiss_pairing_method: Optional[str] = None
    
    # Compass draw settings
    compass_draw_rounds: Optional[int] = None
    
    # Playoff bracket settings
    playoff_teams: Optional[int] = None
    playoff_format: Optional[str] = None
    
    # Game settings
    game_duration: int = 60
    games_per_week: int = 1
    max_teams: Optional[int] = None
    min_teams: int = 4
    
    # Registration settings
    registration_deadline: Optional[date] = None
    registration_fee: Optional[int] = None
    
    # Advanced settings
    settings: Optional[dict] = None

    @validator('tournament_format')
    def validate_tournament_format(cls, v):
        valid_formats = ['round_robin', 'swiss', 'playoff_bracket', 'compass_draw']
        if v not in valid_formats:
            raise ValueError(f'tournament_format must be one of {valid_formats}')
        return v

    @validator('format')
    def validate_format(cls, v):
        valid_formats = ['7v7', '5v5', '4v4', '3v3']
        if v not in valid_formats:
            raise ValueError(f'format must be one of {valid_formats}')
        return v

    @validator('start_date')
    def validate_start_date(cls, v):
        if v < date.today():
            raise ValueError('start_date cannot be in the past')
        return v

    @validator('num_weeks')
    def validate_num_weeks(cls, v):
        if v < 1:
            raise ValueError('num_weeks must be at least 1')
        return v

class LeagueUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[date] = None
    num_weeks: Optional[int] = None
    format: Optional[str] = None
    tournament_format: Optional[str] = None
    regular_season_weeks: Optional[int] = None
    playoff_weeks: Optional[int] = None
    swiss_rounds: Optional[int] = None
    swiss_pairing_method: Optional[str] = None
    compass_draw_rounds: Optional[int] = None
    playoff_teams: Optional[int] = None
    playoff_format: Optional[str] = None
    game_duration: Optional[int] = None
    games_per_week: Optional[int] = None
    max_teams: Optional[int] = None
    min_teams: Optional[int] = None
    registration_deadline: Optional[date] = None
    registration_fee: Optional[int] = None
    settings: Optional[dict] = None
    is_active: Optional[bool] = None

class LeagueResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    start_date: date
    end_date: Optional[date]
    num_weeks: int
    format: str
    tournament_format: str
    regular_season_weeks: Optional[int]
    playoff_weeks: Optional[int]
    swiss_rounds: Optional[int]
    swiss_pairing_method: Optional[str]
    compass_draw_rounds: Optional[int]
    playoff_teams: Optional[int]
    playoff_format: Optional[str]
    game_duration: int
    games_per_week: int
    max_teams: Optional[int]
    min_teams: int
    registration_deadline: Optional[date]
    registration_fee: Optional[int]
    settings: Optional[dict]
    is_active: bool
    created_by: str
    created_at: datetime
    updated_at: datetime
    registered_players_count: int
    registered_teams_count: int

    class Config:
        from_attributes = True

class LeagueStatsResponse(BaseModel):
    league_id: int
    total_players: int
    total_teams: int
    registration_status: str  # 'open', 'closed', 'full'
    days_until_start: int
    days_until_deadline: Optional[int]

class AdminConfigResponse(BaseModel):
    id: int
    email: str
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class AdminConfigCreateRequest(BaseModel):
    email: str
    role: str = "admin"

class AdminConfigUpdateRequest(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None

# Helper function to check if user is admin
async def get_admin_user(
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Check if the authenticated user has admin privileges"""
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Get user's email from Clerk
    user_email = user.email_addresses[0].email_address if user.email_addresses else None
    if not user_email:
        raise HTTPException(status_code=403, detail="Email address required for admin access")
    
    # Check if user's email is in admin config
    if not AdminService.is_admin_email(db, user_email):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return user

# Helper function to calculate end date based on tournament format
def calculate_end_date(start_date: date, num_weeks: int, tournament_format: str, 
                      regular_season_weeks: Optional[int] = None) -> date:
    """Calculate the end date based on tournament format and number of weeks"""
    if tournament_format == 'playoff_bracket' and regular_season_weeks:
        # For playoff bracket, use regular season weeks + playoff weeks
        total_weeks = regular_season_weeks + (num_weeks - regular_season_weeks)
    else:
        total_weeks = num_weeks
    
    # Calculate end date (assuming games are weekly)
    end_date = start_date + timedelta(weeks=total_weeks - 1)
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
        created_by=admin_user.id
    )
    
    try:
        db.add(league)
        db.commit()
        db.refresh(league)
        
        # Return with player/team counts
        return LeagueResponse(
            **league.__dict__,
            registered_players_count=0,
            registered_teams_count=0
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create league: {str(e)}")

@router.get("/leagues", response_model=List[LeagueResponse], summary="Get all leagues (admin view)")
async def get_all_leagues(
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
):
    """Get all leagues with registration statistics"""
    leagues = db.query(League).order_by(League.created_at.desc()).all()
    
    result = []
    for league in leagues:
        # Count registered players and teams
        player_count = db.query(Player).filter(
            Player.league_id == league.id,
            Player.registration_status == 'registered'
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
    league_id: int,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
):
    """Get detailed information about a specific league"""
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    
    # Count registered players and teams
    player_count = db.query(Player).filter(
        Player.league_id == league.id,
        Player.registration_status == 'registered'
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
    league_id: int,
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
    
    league.updated_at = datetime.now()
    
    try:
        db.commit()
        db.refresh(league)
        
        # Return with player/team counts
        player_count = db.query(Player).filter(
            Player.league_id == league.id,
            Player.registration_status == 'registered'
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
        raise HTTPException(status_code=500, detail=f"Failed to update league: {str(e)}")

@router.delete("/leagues/{league_id}", summary="Delete league")
async def delete_league(
    league_id: int,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
):
    """Delete a league (soft delete by setting is_active to False)"""
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    
    # Check if there are registered players
    player_count = db.query(Player).filter(
        Player.league_id == league.id,
        Player.registration_status == 'registered'
    ).count()
    
    if player_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete league with {player_count} registered players. Consider deactivating instead."
        )
    
    try:
        league.is_active = False
        league.updated_at = datetime.now()
        db.commit()
        return {"message": "League deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete league: {str(e)}")

@router.get("/leagues/{league_id}/stats", response_model=LeagueStatsResponse, summary="Get league statistics")
async def get_league_stats(
    league_id: int,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
):
    """Get detailed statistics for a league"""
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    
    # Count players and teams
    total_players = db.query(Player).filter(
        Player.league_id == league.id,
        Player.registration_status == 'registered'
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

# Admin Management Endpoints
@router.get("/admins", response_model=List[AdminConfigResponse], summary="Get all admin configurations")
async def get_admin_configs(
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
):
    """Get all admin email configurations"""
    admins = AdminService.get_all_admins(db)
    return [AdminConfigResponse.from_orm(admin) for admin in admins]

@router.post("/admins", response_model=AdminConfigResponse, summary="Add admin email")
async def add_admin_email(
    admin_data: AdminConfigCreateRequest,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
):
    """Add a new admin email address"""
    try:
        admin_config = AdminService.add_admin_email(db, admin_data.email, admin_data.role)
        return AdminConfigResponse.from_orm(admin_config)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to add admin: {str(e)}")

@router.put("/admins/{email}", response_model=AdminConfigResponse, summary="Update admin configuration")
async def update_admin_config(
    email: str,
    admin_data: AdminConfigUpdateRequest,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
):
    """Update admin configuration"""
    try:
        if admin_data.role:
            AdminService.update_admin_role(db, email, admin_data.role)
        
        # Get updated admin config
        admin_config = db.query(AdminConfig).filter(
            AdminConfig.email == email.lower()
        ).first()
        
        if not admin_config:
            raise HTTPException(status_code=404, detail="Admin not found")
        
        return AdminConfigResponse.from_orm(admin_config)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update admin: {str(e)}")

@router.delete("/admins/{email}", summary="Remove admin privileges")
async def remove_admin_email(
    email: str,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
):
    """Remove admin privileges from an email address"""
    try:
        success = AdminService.remove_admin_email(db, email)
        if not success:
            raise HTTPException(status_code=404, detail="Admin not found")
        return {"message": f"Admin privileges removed from {email}"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to remove admin: {str(e)}") 