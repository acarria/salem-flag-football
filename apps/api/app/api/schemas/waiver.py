from pydantic import BaseModel, ConfigDict, Field
from typing import Optional
from uuid import UUID
from datetime import datetime


class WaiverResponse(BaseModel):
    id: UUID
    version: str
    content: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WaiverSignRequest(BaseModel):
    waiver_id: UUID
    league_id: UUID
    full_name_typed: str = Field(..., min_length=1, max_length=200)


class WaiverSignResponse(BaseModel):
    signed_at: datetime
    waiver_version: str


class WaiverStatusResponse(BaseModel):
    signed: bool
    signed_at: Optional[datetime] = None
    waiver_version: Optional[str] = None
    waiver_deadline: Optional[datetime] = None


class SignedWaiverSummaryResponse(BaseModel):
    signature_id: UUID
    league_id: UUID
    league_name: str
    waiver_version: str
    signed_at: datetime
    full_name_typed: str
    has_pdf: bool


class SignedWaiverDetailResponse(BaseModel):
    signature_id: UUID
    league_id: UUID
    league_name: str
    waiver_version: str
    waiver_content: str
    full_name_typed: str
    signed_at: datetime
    has_pdf: bool


class PresignedUrlResponse(BaseModel):
    url: str


class AdminWaiverSignatureResponse(BaseModel):
    id: UUID
    player_name: str
    player_email: str
    waiver_version: str
    signed_at: datetime
    pdf_url: Optional[str] = None


class AdminCreateWaiverRequest(BaseModel):
    version: str = Field(..., min_length=1, max_length=50)
    content: str = Field(..., min_length=1, max_length=50000)
