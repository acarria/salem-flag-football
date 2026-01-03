# Schemas package
# Export all schemas for convenient imports

# Admin schemas
from app.api.schemas.admin import (
    # League Management
    LeagueCreateRequest,
    LeagueUpdateRequest,
    LeagueResponse,
    LeagueStatsResponse,
    LeagueMemberResponse,
    # Team Generation
    TeamGenerationRequest,
    TeamGenerationResponse,
    # Schedule Management
    ScheduleGenerationRequest,
    ScheduleGenerationResponse,
    # Admin Management
    AdminConfigResponse,
    AdminConfigCreateRequest,
    AdminConfigUpdateRequest,
    # User Management
    UserResponse,
    PaginatedUserResponse,
    # Field Management
    FieldResponse,
    FieldCreateRequest,
    FieldUpdateRequest,
    # Field Availability
    FieldAvailabilityResponse,
    FieldAvailabilityCreateRequest,
    FieldAvailabilityUpdateRequest,
)

# User schemas
from app.api.schemas.user import (
    UserProfile,
    UserBase,
    UserCreate,
    UserOut,
)

# League schemas
from app.api.schemas.league import (
    PublicLeagueResponse,
)

# Registration schemas
from app.api.schemas.registration import (
    SoloRegistrationRequest,
    GroupRegistrationRequest,
    RegistrationResponse,
    LeagueRegistrationResponse,
)

__all__ = [
    # Admin schemas
    "LeagueCreateRequest",
    "LeagueUpdateRequest",
    "LeagueResponse",
    "LeagueStatsResponse",
    "LeagueMemberResponse",
    "TeamGenerationRequest",
    "TeamGenerationResponse",
    "ScheduleGenerationRequest",
    "ScheduleGenerationResponse",
    "AdminConfigResponse",
    "AdminConfigCreateRequest",
    "AdminConfigUpdateRequest",
    "UserResponse",
    "PaginatedUserResponse",
    "FieldResponse",
    "FieldCreateRequest",
    "FieldUpdateRequest",
    "FieldAvailabilityResponse",
    "FieldAvailabilityCreateRequest",
    "FieldAvailabilityUpdateRequest",
    # User schemas
    "UserProfile",
    "UserBase",
    "UserCreate",
    "UserOut",
    # League schemas
    "PublicLeagueResponse",
    # Registration schemas
    "SoloRegistrationRequest",
    "GroupRegistrationRequest",
    "RegistrationResponse",
    "LeagueRegistrationResponse",
]
