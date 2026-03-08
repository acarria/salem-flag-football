from pydantic import BaseModel, EmailStr
from typing import Optional
from uuid import UUID

# User profile schema (moved from app/api/user.py)
class UserProfile(BaseModel):
    firstName: str
    lastName: str
    email: str
    phone: str
    dateOfBirth: str
    gender: str
    communicationsAccepted: bool
    registrationStatus: str
    teamId: Optional[str] = None  # UUID
    groupName: Optional[str] = None
    registrationDate: Optional[str] = None
    paymentStatus: Optional[str] = None
    waiverStatus: Optional[str] = None

# Legacy schemas from app/schemas/user.py (kept for potential future use)
class UserBase(BaseModel):
    email: EmailStr
    is_active: bool = True
    is_admin: bool = False

class UserCreate(UserBase):
    password: str

class UserOut(UserBase):
    id: UUID

    class Config:
        orm_mode = True

