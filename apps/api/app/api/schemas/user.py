from pydantic import BaseModel, EmailStr, Field
from typing import Optional


class UserProfile(BaseModel):
    firstName: str = Field(..., max_length=100)
    lastName: str = Field(..., max_length=100)
    email: EmailStr
    phone: str = Field(default="", max_length=30)
    dateOfBirth: Optional[str] = Field(default=None, max_length=10)
    gender: str = Field(default="", max_length=30)
    communicationsAccepted: bool
    registrationDate: Optional[str] = None
