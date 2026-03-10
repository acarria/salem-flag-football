from pydantic import BaseModel, validator
from typing import List, Optional
from datetime import date, datetime
from uuid import UUID

# Registration Request Schemas
class SoloRegistrationRequest(BaseModel):
    """Schema for solo player registration to a league."""
    league_id: UUID
    firstName: str
    lastName: str
    email: str
    phone: str
    dateOfBirth: str  # Format: YYYY-MM-DD
    gender: str
    termsAccepted: bool
    communicationsAccepted: bool
    groupName: Optional[str] = None  # Optional: if registering as part of a group

    @validator('termsAccepted')
    def validate_terms_accepted(cls, v):
        """Validate that terms are accepted."""
        if not v:
            raise ValueError('Terms must be accepted to register')
        return v

    @validator('dateOfBirth')
    def validate_date_of_birth(cls, v):
        """Validate date of birth format."""
        if not v or len(v.strip()) == 0:
            raise ValueError('dateOfBirth is required')
        try:
            date.fromisoformat(v)
        except ValueError:
            raise ValueError('dateOfBirth must be in YYYY-MM-DD format')
        return v

class GroupPlayerInfo(BaseModel):
    """Schema for an invitee in a group registration."""
    firstName: str
    lastName: str
    email: str

class GroupRegistrationRequest(BaseModel):
    """Schema for group registration to a league.

    The authenticated user (organizer) is confirmed immediately.
    `players` contains only the invitees — not the organizer.
    """
    league_id: UUID
    groupName: str
    players: List[GroupPlayerInfo]
    termsAccepted: bool
    communicationsAccepted: bool

    @validator('termsAccepted')
    def validate_terms_accepted(cls, v):
        if not v:
            raise ValueError('Terms must be accepted to register')
        return v

    @validator('players')
    def validate_players(cls, v):
        if not v or len(v) == 0:
            raise ValueError('At least one invitee is required for group registration')
        if len(v) > 20:
            raise ValueError('Group cannot exceed 20 invitees')
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

    class Config:
        from_attributes = True

class RegistrationResponse(BaseModel):
    """Response schema for registration operations."""
    success: bool
    message: str
    registration: Optional[LeagueRegistrationResponse] = None
    player_id: Optional[UUID] = None

# Invitation Schemas
class InvitationDetailResponse(BaseModel):
    """Public invitation details returned by GET /registration/invite/{token}."""
    token: str
    group_id: UUID
    group_name: str
    league_id: UUID
    league_name: str
    inviter_name: str
    invitee_first_name: str
    invitee_last_name: str
    invitee_email: str
    status: str
    expires_at: str

class PendingInvitationResponse(BaseModel):
    """Summary of a pending invitation for the /invitations/me endpoint."""
    token: str
    group_name: str
    league_name: str
    inviter_name: str
    expires_at: str
