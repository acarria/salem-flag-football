from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserProfile(BaseModel):
    first_name: str = Field(..., max_length=100)
    last_name: str = Field(..., max_length=100)
    email: EmailStr
    phone: str = Field(default="", max_length=30)
    date_of_birth: Optional[date] = None
    gender: str = Field(default="", max_length=30)
    communications_accepted: bool
    registration_date: Optional[str] = None


class UserProfileResponse(BaseModel):
    first_name: str
    last_name: str
    email: str
    phone: str
    date_of_birth: Optional[date] = None
    gender: str
    communications_accepted: bool
    registration_date: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
