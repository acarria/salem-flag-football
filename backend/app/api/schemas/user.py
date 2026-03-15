from pydantic import BaseModel, ConfigDict, EmailStr
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

    model_config = ConfigDict(from_attributes=True)

