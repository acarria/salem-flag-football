from pydantic import BaseModel, ConfigDict, field_validator, EmailStr, Field
from typing import List, Optional
from datetime import date
from uuid import UUID

# Registration Request Schemas
class SoloRegistrationRequest(BaseModel):
    """Schema for solo player registration to a league."""
    league_id: UUID
    firstName: str = Field(..., max_length=100)
    lastName: str = Field(..., max_length=100)
    email: EmailStr
    phone: str = Field(..., max_length=20)
    dateOfBirth: date
    gender: str = Field(..., max_length=20)
    termsAccepted: bool
    communicationsAccepted: bool
    groupName: Optional[str] = Field(None, max_length=100)

    @field_validator('termsAccepted')
    @classmethod
    def validate_terms_accepted(cls, v):
        """Validate that terms are accepted."""
        if not v:
            raise ValueError('Terms must be accepted to register')
        return v

class GroupPlayerInfo(BaseModel):
    """Schema for an invitee in a group registration."""
    firstName: str = Field(..., max_length=100)
    lastName: str = Field(..., max_length=100)
    email: EmailStr

class GroupRegistrationRequest(BaseModel):
    """Schema for group registration to a league.

    The authenticated user (organizer) is confirmed immediately.
    `players` contains only the invitees — not the organizer.
    """
    league_id: UUID
    groupName: str = Field(..., max_length=100)
    players: List[GroupPlayerInfo] = Field(..., max_length=10)
    termsAccepted: bool
    communicationsAccepted: bool

    @field_validator('termsAccepted')
    @classmethod
    def validate_terms_accepted(cls, v):
        if not v:
            raise ValueError('Terms must be accepted to register')
        return v

    @field_validator('players')
    @classmethod
    def validate_players(cls, v):
        if not v or len(v) == 0:
            raise ValueError('At least one invitee is required for group registration')
        return v

# Registration Response Schemas
class LeagueRegistrationResponse(BaseModel):
    """Schema for a single league registration."""
    id: UUID
    league_id: UUID
    league_name: Optional[str] = None
    player_id: UUID
    registration_status: str
    payment_status: str
    waiver_status: str
    team_id: Optional[UUID] = None
    group_id: Optional[UUID] = None
    group_name: Optional[str] = None
    created_at: str
    updated_at: str

    model_config = ConfigDict(from_attributes=True)

class RegistrationResponse(BaseModel):
    """Response schema for registration operations."""
    success: bool
    message: str
    registration: Optional[LeagueRegistrationResponse] = None
    player_id: Optional[UUID] = None

# Invitation Schemas
class InvitationDetailResponse(BaseModel):
    """Public invitation details returned by GET /registration/invite/{token}."""
    group_id: UUID
    group_name: str
    league_id: UUID
    league_name: str
    inviter_name: str
    invitee_first_name: str
    invitee_last_name: str
    status: str
    expires_at: str

class PendingInvitationResponse(BaseModel):
    """Summary of a pending invitation for the /invitations/me endpoint."""
    invitation_id: UUID
    group_name: str
    league_name: str
    inviter_name: str
    expires_at: str


class GroupMemberDetail(BaseModel):
    """Details of one member (confirmed or pending invitee) in a group."""
    invitation_id: Optional[UUID] = None
    player_id: Optional[UUID] = None
    first_name: str
    last_name: str
    email: Optional[str] = None
    status: str
    is_organizer: bool = False


class MyGroupResponse(BaseModel):
    """A group the current user is part of (as organizer or confirmed member)."""
    group_id: UUID
    group_name: str
    league_id: UUID
    league_name: str
    is_organizer: bool
    members: List[GroupMemberDetail]


class SuccessResponse(BaseModel):
    success: bool
    message: str


class TeamMemberPublic(BaseModel):
    """A single roster member — first/last name only, no PII."""
    first_name: str
    last_name: str
    is_you: bool


class MyTeamResponse(BaseModel):
    """The calling user's team roster for a league."""
    team_id: UUID
    team_name: str
    team_color: Optional[str] = None
    members: List[TeamMemberPublic]
