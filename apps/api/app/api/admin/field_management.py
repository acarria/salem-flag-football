import logging
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.api.admin.dependencies import get_admin_user
from app.api.schemas.admin import FieldCreateRequest, FieldResponse, FieldUpdateRequest
from app.api.schemas.common import SuccessResponse
from app.core.limiter import limiter
from app.db.db import get_db
from app.services.exceptions import ConflictError, NotFoundError, ServiceError
import app.services.field_service as field_svc

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Global field CRUD
# ---------------------------------------------------------------------------

@router.post("/fields", response_model=FieldResponse, summary="Create a new field")
@limiter.limit("30/minute")
async def create_field_global(
    request: Request,
    field_data: FieldCreateRequest,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user),
):
    try:
        field = field_svc.create_field(
            db,
            name=field_data.name,
            field_number=field_data.field_number,
            street_address=field_data.street_address,
            city=field_data.city,
            state=field_data.state,
            zip_code=field_data.zip_code,
            country=field_data.country,
            facility_name=field_data.facility_name,
            additional_notes=field_data.additional_notes,
            created_by=admin_user["id"],
        )
        db.commit()
        db.refresh(field)
        return FieldResponse.model_validate(field)
    except ServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        db.rollback()
        logger.exception("Failed to create field: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")


@router.get("/fields", response_model=List[FieldResponse], summary="Get all fields")
@limiter.limit("30/minute")
async def get_all_fields(
    request: Request,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user),
):
    fields = field_svc.list_fields(db, is_active=is_active)
    return [FieldResponse.model_validate(f) for f in fields]


@router.get("/fields/{field_id}", response_model=FieldResponse, summary="Get a specific field")
@limiter.limit("30/minute")
async def get_field_by_id_global(
    request: Request,
    field_id: UUID,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user),
):
    try:
        field = field_svc.get_field(db, field_id)
    except NotFoundError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    return FieldResponse.model_validate(field)


@router.put("/fields/{field_id}", response_model=FieldResponse, summary="Update a field")
@limiter.limit("30/minute")
async def update_field_global(
    request: Request,
    field_id: UUID,
    field_data: FieldUpdateRequest,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user),
):
    try:
        updates = field_data.model_dump(exclude_unset=True)
        field = field_svc.update_field(db, field_id, **updates)
        db.commit()
        db.refresh(field)
        return FieldResponse.model_validate(field)
    except NotFoundError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        db.rollback()
        logger.exception("Failed to update field: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")


@router.delete("/fields/{field_id}", response_model=SuccessResponse, summary="Delete a field")
@limiter.limit("30/minute")
async def delete_field_global(
    request: Request,
    field_id: UUID,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user),
):
    try:
        field_svc.soft_delete_field(db, field_id)
        db.commit()
        return SuccessResponse(success=True, message="Field deleted successfully")
    except NotFoundError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        db.rollback()
        logger.exception("Failed to delete field: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")


# ---------------------------------------------------------------------------
# League ↔ Field association
# ---------------------------------------------------------------------------

@router.post("/leagues/{league_id}/fields/{field_id}", response_model=SuccessResponse, summary="Associate a field with a league")
@limiter.limit("30/minute")
async def associate_field_with_league(
    request: Request,
    league_id: UUID,
    field_id: UUID,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user),
):
    try:
        field_svc.associate_field_to_league(db, league_id, field_id)
        db.commit()
        return SuccessResponse(success=True, message="Field associated with league successfully")
    except (NotFoundError, ConflictError) as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        db.rollback()
        logger.exception("Failed to associate field with league: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")


@router.delete("/leagues/{league_id}/fields/{field_id}", response_model=SuccessResponse, summary="Disassociate a field from a league")
@limiter.limit("30/minute")
async def disassociate_field_from_league(
    request: Request,
    league_id: UUID,
    field_id: UUID,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user),
):
    try:
        field_svc.disassociate_field_from_league(db, league_id, field_id)
        db.commit()
        return SuccessResponse(success=True, message="Field disassociated from league successfully")
    except NotFoundError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        db.rollback()
        logger.exception("Failed to disassociate field from league: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")


@router.get("/leagues/{league_id}/fields", response_model=List[FieldResponse], summary="Get all fields for a league")
@limiter.limit("30/minute")
async def get_league_fields(
    request: Request,
    league_id: UUID,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user),
):
    try:
        fields = field_svc.get_league_fields(db, league_id, is_active=is_active)
    except NotFoundError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    return [FieldResponse.model_validate(f) for f in fields]


@router.post("/leagues/{league_id}/fields", response_model=FieldResponse, summary="Create a new field and associate it with a league")
@limiter.limit("30/minute")
async def create_field_for_league(
    request: Request,
    league_id: UUID,
    field_data: FieldCreateRequest,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user),
):
    try:
        field = field_svc.create_field_and_associate(
            db,
            league_id,
            created_by=admin_user["id"],
            name=field_data.name,
            field_number=field_data.field_number,
            street_address=field_data.street_address,
            city=field_data.city,
            state=field_data.state,
            zip_code=field_data.zip_code,
            country=field_data.country,
            facility_name=field_data.facility_name,
            additional_notes=field_data.additional_notes,
        )
        db.commit()
        db.refresh(field)
        return FieldResponse.model_validate(field)
    except NotFoundError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        db.rollback()
        logger.exception("Failed to create field for league: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")
