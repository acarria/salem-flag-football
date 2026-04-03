"""Admin Waiver Management — endpoints for viewing signatures and managing waiver versions."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.core.limiter import limiter
from app.db.db import get_db
from app.api.admin.dependencies import get_admin_user
from app.services.exceptions import ServiceError
import app.services.waiver_service as waiver_svc
from app.services.s3_service import generate_presigned_url
from app.api.schemas.waiver import (
    AdminCreateWaiverRequest,
    AdminWaiverSignatureResponse,
    WaiverResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/waivers", response_model=list[AdminWaiverSignatureResponse], summary="List waiver signatures for a league")
@limiter.limit("30/minute")
async def list_waiver_signatures(
    request: Request,
    league_id: UUID = Query(...),
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user),
):
    signatures = waiver_svc.get_signatures_for_league(db, league_id)
    return [
        AdminWaiverSignatureResponse(
            id=sig["id"],
            player_name=sig["player_name"],
            player_email=sig["player_email"],
            waiver_version=sig["waiver_version"],
            signed_at=sig["signed_at"],
            pdf_url=generate_presigned_url(sig["pdf_path"]) if sig.get("pdf_path") else None,
        )
        for sig in signatures
    ]


@router.post("/waivers", response_model=WaiverResponse, status_code=201, summary="Create a new waiver version")
@limiter.limit("5/minute")
async def create_waiver_version(
    request: Request,
    body: AdminCreateWaiverRequest,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user),
):
    try:
        waiver = waiver_svc.create_waiver_version(db, body.version, body.content)
        db.commit()
        db.refresh(waiver)
    except ServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        db.rollback()
        logger.exception("Failed to create waiver version: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")

    return WaiverResponse.model_validate(waiver)


@router.get("/waivers/{signature_id}/pdf", summary="Get presigned PDF download URL")
@limiter.limit("30/minute")
async def get_waiver_pdf_url(
    request: Request,
    signature_id: UUID,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user),
):
    from app.models.waiver import WaiverSignature
    sig = db.query(WaiverSignature).filter(WaiverSignature.id == signature_id).first()
    if not sig:
        raise HTTPException(status_code=404, detail="Signature not found")
    if not sig.pdf_path:
        raise HTTPException(status_code=404, detail="PDF not available for this signature")

    url = generate_presigned_url(sig.pdf_path)
    if not url:
        raise HTTPException(status_code=503, detail="PDF storage not configured")
    return {"url": url}
