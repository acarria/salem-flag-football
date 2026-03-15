from pydantic import BaseModel, validator, field_validator
from typing import List, Optional
from datetime import datetime, date, time
from decimal import Decimal
from uuid import UUID

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
        valid_formats = ['7v7', '5v5']
        if v not in valid_formats:
            raise ValueError(f'format must be one of {valid_formats}')
        return v

    @validator('max_teams')
    def validate_max_teams(cls, v):
        if v is not None and v > 10:
            raise ValueError('max_teams cannot exceed 10')
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

    @validator('max_teams')
    def validate_max_teams(cls, v):
        if v is not None and v > 10:
            raise ValueError('max_teams cannot exceed 10')
        return v

class LeagueResponse(BaseModel):
    id: UUID
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
    league_id: UUID
    total_players: int
    total_teams: int
    registration_status: str  # 'open', 'closed', 'full'
    days_until_start: int
    days_until_deadline: Optional[int]

# Team Management Schemas
class LeagueMemberResponse(BaseModel):
    id: UUID
    player_id: UUID
    first_name: str
    last_name: str
    email: str
    group_id: Optional[UUID] = None
    group_name: Optional[str] = None
    team_id: Optional[UUID] = None
    team_name: Optional[str] = None
    registration_status: str
    payment_status: str
    waiver_status: str
    created_at: datetime

    class Config:
        from_attributes = True

class TeamResponse(BaseModel):
    id: UUID
    league_id: UUID
    name: str
    color: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

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
    id: UUID
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

# User Management Schemas
class UserResponse(BaseModel):
    clerk_user_id: str
    first_name: str
    last_name: str
    email: str
    phone: Optional[str]
    date_of_birth: Optional[date]
    gender: Optional[str]
    created_at: datetime
    leagues_count: int  # Number of leagues the user is registered for

    class Config:
        from_attributes = True

class PaginatedUserResponse(BaseModel):
    users: List[UserResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

# Field Management Schemas
class FieldResponse(BaseModel):
    id: UUID
    name: str
    field_number: Optional[str] = None
    street_address: str
    city: str
    state: str
    zip_code: str
    country: str
    facility_name: Optional[str] = None
    additional_notes: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class FieldCreateRequest(BaseModel):
    name: str
    field_number: Optional[str] = None
    street_address: str
    city: str
    state: str
    zip_code: str
    country: str = "USA"
    facility_name: Optional[str] = None
    additional_notes: Optional[str] = None

    @validator('zip_code')
    def validate_zip_code(cls, v):
        """Validate zip code format (basic validation)."""
        if not v or len(v.strip()) == 0:
            raise ValueError('zip_code cannot be empty')
        return v.strip()

    @validator('state')
    def validate_state(cls, v):
        """Validate state is provided."""
        if not v or len(v.strip()) == 0:
            raise ValueError('state cannot be empty')
        return v.strip()

    @validator('city')
    def validate_city(cls, v):
        """Validate city is provided."""
        if not v or len(v.strip()) == 0:
            raise ValueError('city cannot be empty')
        return v.strip()

    @validator('street_address')
    def validate_street_address(cls, v):
        """Validate street address is provided."""
        if not v or len(v.strip()) == 0:
            raise ValueError('street_address cannot be empty')
        return v.strip()

class FieldUpdateRequest(BaseModel):
    name: Optional[str] = None
    field_number: Optional[str] = None
    street_address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    country: Optional[str] = None
    facility_name: Optional[str] = None
    additional_notes: Optional[str] = None
    is_active: Optional[bool] = None

# Field Availability Schemas
class FieldAvailabilityResponse(BaseModel):
    id: UUID
    field_id: UUID
    field_name: Optional[str] = None  # Populated from field relationship
    is_recurring: bool
    day_of_week: Optional[int] = None  # 0=Monday, 6=Sunday
    recurrence_start_date: Optional[date] = None
    recurrence_end_date: Optional[date] = None
    custom_date: Optional[date] = None
    start_time: time
    end_time: time
    notes: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class FieldAvailabilityCreateRequest(BaseModel):
    field_id: UUID  # Required: which field this availability is for
    is_recurring: bool
    day_of_week: Optional[int] = None  # Required if is_recurring=True, 0=Monday, 6=Sunday
    recurrence_start_date: Optional[date] = None  # Required if is_recurring=True
    recurrence_end_date: Optional[date] = None  # Optional, None = indefinite
    custom_date: Optional[date] = None  # Required if is_recurring=False
    start_time: time
    end_time: time
    notes: Optional[str] = None

    @validator('day_of_week')
    def validate_day_of_week(cls, v, values):
        """Validate day_of_week is provided for recurring availability and is in valid range."""
        is_recurring = values.get('is_recurring', False)
        if is_recurring and v is None:
            raise ValueError('day_of_week is required for recurring availability')
        if v is not None and (v < 0 or v > 6):
            raise ValueError('day_of_week must be between 0 (Monday) and 6 (Sunday)')
        return v

    @validator('recurrence_start_date')
    def validate_recurrence_start_date(cls, v, values):
        """Validate recurrence_start_date is provided for recurring availability."""
        is_recurring = values.get('is_recurring', False)
        if is_recurring and v is None:
            raise ValueError('recurrence_start_date is required for recurring availability')
        return v

    @validator('custom_date')
    def validate_custom_date(cls, v, values):
        """Validate custom_date is provided for one-time availability."""
        is_recurring = values.get('is_recurring', False)
        if not is_recurring and v is None:
            raise ValueError('custom_date is required for one-time availability')
        return v

    @validator('end_time')
    def validate_end_time(cls, v, values):
        """Validate end_time is after start_time."""
        start_time = values.get('start_time')
        if start_time and v <= start_time:
            raise ValueError('end_time must be after start_time')
        return v

class FieldAvailabilityUpdateRequest(BaseModel):
    field_id: Optional[UUID] = None  # Optional: can change which field this availability is for
    is_recurring: Optional[bool] = None
    day_of_week: Optional[int] = None
    recurrence_start_date: Optional[date] = None
    recurrence_end_date: Optional[date] = None
    custom_date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

    @validator('day_of_week')
    def validate_day_of_week(cls, v):
        """Validate day_of_week is in valid range."""
        if v is not None and (v < 0 or v > 6):
            raise ValueError('day_of_week must be between 0 (Monday) and 6 (Sunday)')
        return v

# Game Management Schemas
class GameUpdateRequest(BaseModel):
    team1_score: Optional[int] = None
    team2_score: Optional[int] = None
    winner_id: Optional[UUID] = None
    status: Optional[str] = None  # scheduled, in_progress, completed, cancelled
    game_date: Optional[date] = None
    game_time: Optional[str] = None  # "HH:MM"
    field_id: Optional[UUID] = None

    @validator('status')
    def validate_status(cls, v):
        if v is not None and v not in ('scheduled', 'in_progress', 'completed', 'cancelled'):
            raise ValueError('status must be one of: scheduled, in_progress, completed, cancelled')
        return v

    @validator('game_time')
    def validate_game_time(cls, v):
        if v is not None:
            parts = v.split(':')
            if len(parts) != 2 or not parts[0].isdigit() or not parts[1].isdigit():
                raise ValueError('game_time must be in HH:MM format')
        return v
