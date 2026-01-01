from pydantic import BaseModel, validator
from typing import List, Optional
from datetime import datetime, date
from decimal import Decimal

# League Management Schemas
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

# Team Management Schemas
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

# Schedule Management Schemas
class ScheduleGenerationRequest(BaseModel):
    start_date: Optional[date] = None  # If not provided, uses league start_date
    game_duration: Optional[int] = None  # Minutes per game
    games_per_week: Optional[int] = None
    time_slots: Optional[List[str]] = None  # e.g., ["18:00", "19:00", "20:00"]

class ScheduleGenerationResponse(BaseModel):
    games_created: int
    weeks_scheduled: int
    schedule_details: List[dict]

# Admin Management Schemas
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
