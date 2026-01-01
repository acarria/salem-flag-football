from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, date, timedelta
from pydantic import BaseModel, validator
from decimal import Decimal
from app.db.db import get_db
from app.models.league import League
from app.models.player import Player
from app.models.team import Team
from app.models.admin_config import AdminConfig
from app.utils.clerk_session import get_current_user_from_session
from app.services.admin_service import AdminService

router = APIRouter(tags=["admin"])

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
    registration_fee: Optional[Decimal] = None
    
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
        valid_formats = ['7v7', '6v6', '5v5']
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

    @validator('registration_fee')
    def validate_registration_fee(cls, v):
        if v is not None and v < 0:
            raise ValueError('registration_fee cannot be negative')
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
    registration_fee: Optional[Decimal] = None
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
    registration_fee: Optional[Decimal]
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
    user=Depends(get_current_user_from_session),
    db: Session = Depends(get_db)
):
    """Check if the authenticated user has admin privileges"""
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Get user's email from session data
    user_email = user.get('email')
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
        created_by=admin_user["id"]
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

@router.get("/test-auth", summary="Test authentication")
async def test_auth(admin_user=Depends(get_admin_user)):
    """Test endpoint to verify authentication is working"""
    return {"message": "Authentication successful", "user": admin_user}

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

# League Member Management Models
class LeagueMemberResponse(BaseModel):
    id: int
    player_id: int
    first_name: str
    last_name: str
    email: str
    group_id: Optional[int]
    group_name: Optional[str]
    team_id: Optional[int]
    team_name: Optional[str]
    registration_status: str
    payment_status: str
    waiver_status: str
    created_at: datetime

    class Config:
        from_attributes = True

class TeamGenerationRequest(BaseModel):
    teams_count: Optional[int] = None  # If not provided, will be calculated based on players
    max_players_per_team: Optional[int] = None
    min_players_per_team: Optional[int] = None
    team_names: Optional[List[str]] = None  # Custom team names
    team_colors: Optional[List[str]] = None  # Custom team colors

class TeamGenerationResponse(BaseModel):
    teams_created: int
    players_assigned: int
    groups_kept_together: int
    groups_split: int
    team_details: List[dict]

class ScheduleGenerationRequest(BaseModel):
    start_date: Optional[date] = None  # If not provided, uses league start_date
    game_duration: Optional[int] = None  # Minutes per game
    games_per_week: Optional[int] = None
    time_slots: Optional[List[str]] = None  # e.g., ["18:00", "19:00", "20:00"]

class ScheduleGenerationResponse(BaseModel):
    games_created: int
    weeks_scheduled: int
    schedule_details: List[dict]

# League Member Management Endpoints
@router.get("/leagues/{league_id}/members", response_model=List[LeagueMemberResponse], summary="Get all league members")
async def get_league_members(
    league_id: int,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
):
    """Get all registered members for a specific league"""
    # Verify league exists
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    
    # Get all league players with their details
    from app.models.league_player import LeaguePlayer
    from app.models.group import Group
    
    league_players = db.query(LeaguePlayer).filter(
        LeaguePlayer.league_id == league_id,
        LeaguePlayer.is_active == True
    ).all()
    
    result = []
    for lp in league_players:
        player = db.query(Player).filter(Player.id == lp.player_id).first()
        if not player:
            continue
            
        # Get group info
        group_name = None
        if lp.group_id:
            group = db.query(Group).filter(Group.id == lp.group_id).first()
            group_name = group.name if group else None
        
        # Get team info
        team_name = None
        if lp.team_id:
            team = db.query(Team).filter(Team.id == lp.team_id).first()
            team_name = team.name if team else None
        
        result.append(LeagueMemberResponse(
            id=lp.id,
            player_id=player.id,
            first_name=player.first_name,
            last_name=player.last_name,
            email=player.email,
            group_id=lp.group_id,
            group_name=group_name,
            team_id=lp.team_id,
            team_name=team_name,
            registration_status=lp.registration_status,
            payment_status=lp.payment_status,
            waiver_status=lp.waiver_status,
            created_at=lp.created_at
        ))
    
    return result

@router.post("/leagues/{league_id}/generate-teams", response_model=TeamGenerationResponse, summary="Generate teams for league")
async def generate_teams(
    league_id: int,
    team_data: TeamGenerationRequest,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
):
    """Generate teams for a league, respecting group registrations when possible"""
    # Verify league exists
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    
    from app.models.league_player import LeaguePlayer
    from app.models.group import Group
    
    # Get all registered players for this league
    registered_players = db.query(LeaguePlayer).filter(
        LeaguePlayer.league_id == league_id,
        LeaguePlayer.registration_status == 'registered',
        LeaguePlayer.is_active == True
    ).all()
    
    if not registered_players:
        raise HTTPException(status_code=400, detail="No registered players found for this league")
    
    # Group players by their group_id
    players_by_group = {}
    ungrouped_players = []
    
    for lp in registered_players:
        if lp.group_id:
            if lp.group_id not in players_by_group:
                players_by_group[lp.group_id] = []
            players_by_group[lp.group_id].append(lp)
        else:
            ungrouped_players.append(lp)
    
    # Calculate optimal number of teams
    total_players = len(registered_players)
    if team_data.teams_count:
        teams_count = team_data.teams_count
    else:
        # Default to 4 teams minimum, or calculate based on players
        teams_count = max(4, total_players // 8)  # Assume ~8 players per team
    
    # Calculate players per team
    players_per_team = total_players // teams_count
    if team_data.max_players_per_team:
        players_per_team = min(players_per_team, team_data.max_players_per_team)
    if team_data.min_players_per_team:
        players_per_team = max(players_per_team, team_data.min_players_per_team)
    
    # Generate team names and colors
    team_names = team_data.team_names or [
        "Red Dragons", "Blue Lightning", "Green Giants", "Yellow Thunder",
        "Purple Power", "Orange Crush", "Black Knights", "White Warriors"
    ]
    team_colors = team_data.team_colors or [
        "#FF4444", "#4444FF", "#44FF44", "#FFFF44",
        "#FF44FF", "#FF8844", "#444444", "#FFFFFF"
    ]
    
    # Clear existing teams for this league
    existing_teams = db.query(Team).filter(Team.league_id == league_id).all()
    for team in existing_teams:
        team.is_active = False
    
    # Create new teams
    teams = []
    for i in range(teams_count):
        team = Team(
            league_id=league_id,
            name=team_names[i % len(team_names)],
            color=team_colors[i % len(team_colors)],
            created_by=admin_user["id"]
        )
        db.add(team)
        db.flush()  # Get the team ID
        teams.append(team)
    
    # Assign players to teams, trying to keep groups together
    groups_kept_together = 0
    groups_split = 0
    players_assigned = 0
    
    # First, try to assign complete groups to teams
    team_assignments = {team.id: [] for team in teams}
    
    for group_id, group_players in players_by_group.items():
        if len(group_players) <= players_per_team:
            # Find a team with enough space for the entire group
            best_team = None
            min_players = float('inf')
            
            for team in teams:
                current_players = len(team_assignments[team.id])
                if current_players + len(group_players) <= players_per_team:
                    if current_players < min_players:
                        min_players = current_players
                        best_team = team
            
            if best_team:
                # Assign entire group to this team
                for lp in group_players:
                    lp.team_id = best_team.id
                    team_assignments[best_team.id].append(lp)
                    players_assigned += 1
                groups_kept_together += 1
            else:
                # Have to split the group
                for lp in group_players:
                    # Find team with most space
                    best_team = min(teams, key=lambda t: len(team_assignments[t.id]))
                    if len(team_assignments[best_team.id]) < players_per_team:
                        lp.team_id = best_team.id
                        team_assignments[best_team.id].append(lp)
                        players_assigned += 1
                groups_split += 1
        else:
            # Group is too large, must split
            for lp in group_players:
                best_team = min(teams, key=lambda t: len(team_assignments[t.id]))
                if len(team_assignments[best_team.id]) < players_per_team:
                    lp.team_id = best_team.id
                    team_assignments[best_team.id].append(lp)
                    players_assigned += 1
            groups_split += 1
    
    # Assign ungrouped players
    for lp in ungrouped_players:
        best_team = min(teams, key=lambda t: len(team_assignments[t.id]))
        if len(team_assignments[best_team.id]) < players_per_team:
            lp.team_id = best_team.id
            team_assignments[best_team.id].append(lp)
            players_assigned += 1
    
    # Commit all changes
    db.commit()
    
    # Prepare response details
    team_details = []
    for team in teams:
        team_players = team_assignments[team.id]
        team_details.append({
            "team_id": team.id,
            "team_name": team.name,
            "team_color": team.color,
            "player_count": len(team_players),
            "players": [
                {
                    "player_id": lp.player_id,
                    "first_name": db.query(Player).filter(Player.id == lp.player_id).first().first_name,
                    "last_name": db.query(Player).filter(Player.id == lp.player_id).first().last_name,
                    "group_id": lp.group_id
                }
                for lp in team_players
            ]
        })
    
    return TeamGenerationResponse(
        teams_created=teams_count,
        players_assigned=players_assigned,
        groups_kept_together=groups_kept_together,
        groups_split=groups_split,
        team_details=team_details
    )

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
    from app.models.game import Game
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
    
    from app.models.game import Game
    
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

@router.post("/leagues/{league_id}/add-fake-data", summary="Add fake data for testing")
async def add_fake_data(
    league_id: int,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
):
    """Add fake players and groups to a league for testing purposes"""
    # Verify league exists
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    
    from app.models.league_player import LeaguePlayer
    from app.models.group import Group
    
    # Create some fake groups
    group_names = ["Friends United", "Work Buddies", "College Alumni", "Neighborhood Crew", "Gym Rats"]
    groups = []
    
    for i, name in enumerate(group_names):
        group = Group(
            league_id=league_id,
            name=name,
            created_by=1,  # Fake player ID
            created_by_clerk=admin_user["id"]
        )
        db.add(group)
        db.flush()
        groups.append(group)
    
    # Create fake players
    first_names = ["John", "Jane", "Mike", "Sarah", "David", "Lisa", "Tom", "Amy", "Chris", "Emma", 
                   "Alex", "Rachel", "Ryan", "Jessica", "Kevin", "Michelle", "Brian", "Stephanie", 
                   "Jason", "Nicole", "Eric", "Amanda", "Mark", "Heather", "Scott", "Melissa"]
    last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", 
                  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", 
                  "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", 
                  "White", "Harris", "Sanchez"]
    
    players_created = 0
    for i in range(24):  # Create 24 fake players
        # Create player
        player = Player(
            clerk_user_id=f"fake_user_{i}",
            first_name=first_names[i % len(first_names)],
            last_name=last_names[i % len(last_names)],
            email=f"player{i}@example.com",
            phone=f"555-{1000+i:04d}",
            date_of_birth=date(1990, 1, 1) + timedelta(days=i*30),
            gender="M" if i % 2 == 0 else "F",
            communications_accepted=True,
            registration_status="registered",
            league_id=league_id,
            created_by=admin_user["id"]
        )
        db.add(player)
        db.flush()
        
        # Create league player entry
        group_id = groups[i % len(groups)].id if i < 20 else None  # First 20 players are in groups
        league_player = LeaguePlayer(
            league_id=league_id,
            player_id=player.id,
            group_id=group_id,
            registration_status="registered",
            payment_status="paid",
            waiver_status="signed",
            created_by=admin_user["id"]
        )
        db.add(league_player)
        players_created += 1
    
    db.commit()
    
    return {
        "message": f"Added {players_created} fake players and {len(groups)} groups to league",
        "players_created": players_created,
        "groups_created": len(groups)
    }

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