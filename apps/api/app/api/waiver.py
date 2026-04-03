"""Waiver API — public endpoints for waiver display and signing."""

import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.core.limiter import limiter
from app.db.db import get_db
from app.models.league import League
from app.models.player import Player
from app.utils.clerk_jwt import get_current_user, get_optional_user
from app.services.exceptions import ServiceError
import app.services.waiver_service as waiver_svc
from app.services.pdf_service import generate_waiver_pdf
from app.services.s3_service import upload_waiver_pdf
from app.services.email_service import send_waiver_confirmation
from app.services.team_generation_service import trigger_team_generation_if_ready
from app.api.schemas.waiver import (
    WaiverResponse,
    WaiverSignRequest,
    WaiverSignResponse,
    WaiverStatusResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_ip(request: Request) -> str | None:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


# ---------------------------------------------------------------------------
# Public: get active waiver
# ---------------------------------------------------------------------------

@router.get("/active", response_model=WaiverResponse, summary="Get the currently active waiver")
@limiter.limit("30/minute")
async def get_active_waiver(
    request: Request,
    user=Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    waiver = waiver_svc.get_active_waiver(db)
    if not waiver:
        raise HTTPException(status_code=404, detail="No active waiver found")
    return WaiverResponse.model_validate(waiver)


# ---------------------------------------------------------------------------
# Authenticated: sign waiver
# ---------------------------------------------------------------------------

@router.post("/sign", response_model=WaiverSignResponse, status_code=201, summary="Sign the liability waiver")
@limiter.limit("5/minute")
async def sign_waiver(
    request: Request,
    body: WaiverSignRequest,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    clerk_user_id = user.get("id")
    if not clerk_user_id:
        raise HTTPException(status_code=401, detail="User ID not found in authentication token")

    player = db.query(Player).filter(Player.clerk_user_id == clerk_user_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player profile not found")

    try:
        signature = waiver_svc.sign_waiver(
            db,
            player_id=player.id,
            league_id=body.league_id,
            waiver_id=body.waiver_id,
            full_name_typed=body.full_name_typed,
            ip_address=_get_ip(request),
            user_agent=request.headers.get("user-agent"),
        )
        db.commit()
        db.refresh(signature)
    except ServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        db.rollback()
        logger.exception("Waiver signing failed: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")

    # Get waiver and league for PDF/email
    waiver = db.query(waiver_svc.Waiver).filter(waiver_svc.Waiver.id == body.waiver_id).first()
    league = db.query(League).filter(League.id == body.league_id).first()
    waiver_version = waiver.version if waiver else "unknown"
    league_name = league.name if league else "Unknown League"

    # Generate PDF, upload to S3, send email (best-effort, don't roll back signature)
    try:
        pdf_bytes = generate_waiver_pdf(
            waiver_content=waiver.content if waiver else "",
            waiver_version=waiver_version,
            league_name=league_name,
            player_name=body.full_name_typed,
            signed_at=signature.signed_at,
            ip_address=_get_ip(request),
        )

        s3_key = upload_waiver_pdf(pdf_bytes, body.league_id, player.id, signature.id)
        if s3_key:
            signature.pdf_path = s3_key
            db.commit()

        send_waiver_confirmation(
            to_email=player.email,
            to_name=f"{player.first_name} {player.last_name}",
            league_name=league_name,
            waiver_version=waiver_version,
            signed_at=signature.signed_at,
            pdf_bytes=pdf_bytes,
        )
        signature.email_sent_at = datetime.now(timezone.utc)
        db.commit()
    except Exception as e:
        logger.exception("Post-sign PDF/email failed for signature %s: %s", signature.id, e)

    # Try to trigger team generation (all waivers might now be complete)
    try:
        trigger_team_generation_if_ready(body.league_id, db)
    except Exception as e:
        logger.exception("Team generation trigger failed after waiver signing: %s", e)

    return WaiverSignResponse(
        signed_at=signature.signed_at,
        waiver_version=waiver_version,
    )


# ---------------------------------------------------------------------------
# Authenticated: check waiver status
# ---------------------------------------------------------------------------

@router.get("/status", response_model=WaiverStatusResponse, summary="Check waiver signing status")
@limiter.limit("30/minute")
async def get_waiver_status(
    request: Request,
    league_id: UUID = Query(...),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    clerk_user_id = user.get("id")
    if not clerk_user_id:
        raise HTTPException(status_code=401, detail="User ID not found in authentication token")

    player = db.query(Player).filter(Player.clerk_user_id == clerk_user_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player profile not found")

    status = waiver_svc.get_waiver_status(db, player.id, league_id)
    return WaiverStatusResponse(**status)
