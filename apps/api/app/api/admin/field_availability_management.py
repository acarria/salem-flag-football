import logging
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.api.admin.dependencies import get_admin_user
from app.api.schemas.admin import (
    FieldAvailabilityCreateRequest,
    FieldAvailabilityResponse,
    FieldAvailabilityUpdateRequest,
)
from app.api.schemas.common import SuccessResponse
from app.core.limiter import limiter
from app.db.db import get_db
from app.models.field import Field
from app.services.exceptions import NotFoundError, ServiceError
import app.services.field_service as field_svc

logger = logging.getLogger(__name__)

router = APIRouter()


def _build_response(avail, field_name: str | None) -> FieldAvailabilityResponse:
    resp = FieldAvailabilityResponse.model_validate(avail)
    resp.field_name = field_name
    return resp


def _build_field_name_map(db: Session, availabilities) -> dict[UUID, str | None]:
    """Batch-load field names for a list of availability records."""
    field_ids = {a.field_id for a in availabilities}
    if not field_ids:
        return {}
    fields = db.query(Field.id, Field.name).filter(Field.id.in_(field_ids)).all()
    return {fid: name for fid, name in fields}


# ---------------------------------------------------------------------------
# Global availability CRUD
# ---------------------------------------------------------------------------

@router.post("/field-availability", response_model=FieldAvailabilityResponse, summary="Create field availability")
@limiter.limit("30/minute")
async def create_field_availability_global(
    request: Request,
    availability_data: FieldAvailabilityCreateRequest,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user),
):
    try:
        avail = field_svc.create_availability(
            db,
            field_id=availability_data.field_id,
            is_recurring=availability_data.is_recurring,
            day_of_week=availability_data.day_of_week if availability_data.is_recurring else None,
            recurrence_start_date=availability_data.recurrence_start_date if availability_data.is_recurring else None,
            recurrence_end_date=availability_data.recurrence_end_date if availability_data.is_recurring else None,
            custom_date=availability_data.custom_date if not availability_data.is_recurring else None,
            start_time=availability_data.start_time,
            end_time=availability_data.end_time,
            notes=availability_data.notes,
            created_by=admin_user["id"],
        )
        db.commit()
        db.refresh(avail)
        field_name = _build_field_name_map(db, [avail]).get(avail.field_id)
        return _build_response(avail, field_name)
    except NotFoundError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        db.rollback()
        logger.exception("Failed to create field availability: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")


@router.get("/field-availability", response_model=List[FieldAvailabilityResponse], summary="Get all field availability records")
@limiter.limit("30/minute")
async def get_all_field_availability(
    request: Request,
    field_id: Optional[UUID] = None,
    is_active: Optional[bool] = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user),
):
    limit = min(limit, 500)
    availabilities = field_svc.list_availabilities(
        db, field_id=field_id, is_active=is_active, skip=skip, limit=limit,
    )
    name_map = _build_field_name_map(db, availabilities)
    return [
        _build_response(a, name_map.get(a.field_id))
        for a in availabilities
    ]


@router.get("/leagues/{league_id}/field-availability", response_model=List[FieldAvailabilityResponse], summary="Get field availability for fields in a league")
@limiter.limit("30/minute")
async def get_field_availability_for_league(
    request: Request,
    league_id: UUID,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user),
):
    try:
        availabilities = field_svc.list_league_availabilities(db, league_id, is_active=is_active)
    except NotFoundError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    name_map = _build_field_name_map(db, availabilities)
    return [
        _build_response(a, name_map.get(a.field_id))
        for a in availabilities
    ]


@router.get("/field-availability/{availability_id}", response_model=FieldAvailabilityResponse, summary="Get a specific field availability record")
@limiter.limit("30/minute")
async def get_field_availability_by_id(
    request: Request,
    availability_id: UUID,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user),
):
    try:
        avail = field_svc.get_availability(db, availability_id)
    except NotFoundError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    return _build_response(avail, _build_field_name_map(db, [avail]).get(avail.field_id))


@router.put("/field-availability/{availability_id}", response_model=FieldAvailabilityResponse, summary="Update field availability record")
@limiter.limit("30/minute")
async def update_field_availability_global(
    request: Request,
    availability_id: UUID,
    availability_data: FieldAvailabilityUpdateRequest,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user),
):
    try:
        updates = availability_data.model_dump(exclude_unset=True)
        avail = field_svc.update_availability(db, availability_id, **updates)
        db.commit()
        db.refresh(avail)
        return _build_response(avail, _build_field_name_map(db, [avail]).get(avail.field_id))
    except (NotFoundError, ServiceError) as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        db.rollback()
        logger.exception("Failed to update field availability: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")


@router.delete("/field-availability/{availability_id}", response_model=SuccessResponse, summary="Delete field availability record")
@limiter.limit("30/minute")
async def delete_field_availability_global(
    request: Request,
    availability_id: UUID,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user),
):
    try:
        field_svc.soft_delete_availability(db, availability_id)
        db.commit()
        return SuccessResponse(success=True, message="Field availability record deleted successfully")
    except NotFoundError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        db.rollback()
        logger.exception("Failed to delete field availability: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")


# ---------------------------------------------------------------------------
# Field-scoped availability CRUD
# ---------------------------------------------------------------------------

@router.post("/fields/{field_id}/availability", response_model=FieldAvailabilityResponse, summary="Add availability window to a field")
@limiter.limit("30/minute")
async def create_field_availability_scoped(
    request: Request,
    field_id: UUID,
    avail_data: FieldAvailabilityCreateRequest,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user),
):
    try:
        avail = field_svc.create_availability(
            db,
            field_id=field_id,
            is_recurring=avail_data.is_recurring,
            day_of_week=avail_data.day_of_week,
            recurrence_start_date=avail_data.recurrence_start_date,
            recurrence_end_date=avail_data.recurrence_end_date,
            custom_date=avail_data.custom_date,
            start_time=avail_data.start_time,
            end_time=avail_data.end_time,
            notes=avail_data.notes,
            created_by=admin_user["id"],
        )
        db.commit()
        db.refresh(avail)
        field = field_svc.get_field(db, field_id)
        return _build_response(avail, field.name)
    except NotFoundError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        db.rollback()
        logger.exception("Failed to create availability: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")


@router.get("/fields/{field_id}/availability", response_model=List[FieldAvailabilityResponse], summary="Get all availability windows for a field")
@limiter.limit("30/minute")
async def get_field_availability_scoped(
    request: Request,
    field_id: UUID,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user),
):
    try:
        field, availabilities = field_svc.get_field_availability_scoped(db, field_id)
    except NotFoundError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    return [_build_response(a, field.name) for a in availabilities]


@router.put("/fields/{field_id}/availability/{avail_id}", response_model=FieldAvailabilityResponse, summary="Update a field availability window")
@limiter.limit("30/minute")
async def update_field_availability_scoped(
    request: Request,
    field_id: UUID,
    avail_id: UUID,
    avail_data: FieldAvailabilityUpdateRequest,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user),
):
    try:
        field, _ = field_svc.get_scoped_availability(db, field_id, avail_id)
        updates = avail_data.model_dump(exclude_unset=True)
        avail = field_svc.update_availability(db, avail_id, **updates)
        db.commit()
        db.refresh(avail)
        return _build_response(avail, field.name)
    except (NotFoundError, ServiceError) as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        db.rollback()
        logger.exception("Failed to update availability: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")


@router.delete("/fields/{field_id}/availability/{avail_id}", response_model=SuccessResponse, summary="Delete a field availability window")
@limiter.limit("30/minute")
async def delete_field_availability_scoped(
    request: Request,
    field_id: UUID,
    avail_id: UUID,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user),
):
    try:
        field_svc.get_scoped_availability(db, field_id, avail_id)
        field_svc.soft_delete_availability(db, avail_id)
        db.commit()
        return SuccessResponse(success=True, message="Availability window deleted.")
    except NotFoundError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        db.rollback()
        logger.exception("Failed to delete availability: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")
