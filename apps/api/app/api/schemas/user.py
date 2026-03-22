from pydantic import BaseModel, ConfigDict, EmailStr, Field
from typing import Optional
from uuid import UUID

# User profile schema (moved from app/api/user.py)
class UserProfile(BaseModel):
    firstName: str = Field(..., max_length=100)
    lastName: str = Field(..., max_length=100)
    email: EmailStr
    phone: str = Field(default="", max_length=30)
    dateOfBirth: str = Field(default="", max_length=10)
    gender: str = Field(default="", max_length=30)
    communicationsAccepted: bool
    registrationDate: Optional[str] = None
    paymentStatus: Optional[str] = Field(default=None, max_length=30)
    waiverStatus: Optional[str] = Field(default=None, max_length=30)

# Legacy schemas from app/schemas/user.py (kept for potential future use)
class UserBase(BaseModel):
    email: EmailStr
    is_active: bool = True
    is_admin: bool = False

class UserCreate(UserBase):
    password: str = Field(..., max_length=128)

class UserOut(UserBase):
    id: UUID

    model_config = ConfigDict(from_attributes=True)
