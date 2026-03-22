import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List, Dict, Optional
from uuid import UUID
from app.db.db import get_db
from app.models.league import League
from app.models.field import Field
from app.models.field_availability import FieldAvailability
from app.models.league_field import LeagueField
from app.api.schemas.admin import (
    FieldResponse, FieldCreateRequest, FieldUpdateRequest,
    FieldAvailabilityResponse, FieldAvailabilityCreateRequest, FieldAvailabilityUpdateRequest,
)
from app.api.admin.dependencies import get_admin_user

logger = logging.getLogger(__name__)

router = APIRouter()


# Global Field Management Endpoints (fields are independent, not tied to leagues)
@router.post("/fields", response_model=FieldResponse, summary="Create a new field")
async def create_field_global(
    field_data: FieldCreateRequest,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
) -> FieldResponse:
    """
    Create a new independent field.

    Fields are independent entities that can be shared across multiple leagues.
    This endpoint creates a field that can then be associated with leagues.

    Args:
        field_data: FieldCreateRequest containing field information:
            - name: Field name (e.g., "Field 1", "Main Field")
            - field_number: Optional field number/identifier
            - street_address: Street address
            - city: City name
            - state: State (e.g., "MA", "Massachusetts")
            - zip_code: ZIP/Postal code
            - country: Country (default: "USA")
            - facility_name: Optional facility name
            - additional_notes: Optional additional notes
        db: SQLAlchemy database session (dependency injection).
        admin_user: Authenticated admin user (dependency injection).

    Returns:
        FieldResponse: The created field record.

    Raises:
        HTTPException 400: If validation fails (e.g., missing required address fields).
    """
    # Create field record (no league_id needed)
    field = Field(
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
        is_active=True
    )

    try:
        db.add(field)
        db.commit()
        db.refresh(field)
        return FieldResponse.model_validate(field)
    except Exception as e:
        db.rollback()
        logger.exception("Failed to create field: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")

@router.get("/fields", response_model=List[FieldResponse], summary="Get all fields")
async def get_all_fields(
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
) -> List[FieldResponse]:
    """
    Retrieve all fields (independent of leagues).

    Args:
        is_active: Optional filter to show only active/inactive fields (default: all).
        db: SQLAlchemy database session (dependency injection).
        admin_user: Authenticated admin user (dependency injection).

    Returns:
        List[FieldResponse]: A list of all fields.
    """
    query = db.query(Field)

    if is_active is not None:
        query = query.filter(Field.is_active == is_active)

    fields = query.order_by(Field.name).all()

    return [FieldResponse.model_validate(field) for field in fields]

@router.get("/fields/{field_id}", response_model=FieldResponse, summary="Get a specific field")
async def get_field_by_id_global(
    field_id: UUID,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
) -> FieldResponse:
    """
    Retrieve a specific field by ID.

    Args:
        field_id: The unique identifier of the field.
        db: SQLAlchemy database session (dependency injection).
        admin_user: Authenticated admin user (dependency injection).

    Returns:
        FieldResponse: The field record.

    Raises:
        HTTPException 404: If the field is not found.
    """
    field = db.query(Field).filter(Field.id == field_id).first()

    if not field:
        raise HTTPException(status_code=404, detail="Field not found")

    return FieldResponse.model_validate(field)

@router.put("/fields/{field_id}", response_model=FieldResponse, summary="Update a field")
async def update_field_global(
    field_id: UUID,
    field_data: FieldUpdateRequest,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
) -> FieldResponse:
    """
    Update an existing field.

    Args:
        field_id: The unique identifier of the field to update.
        field_data: FieldUpdateRequest containing fields to update.
                   Only provided fields will be updated.
        db: SQLAlchemy database session (dependency injection).
        admin_user: Authenticated admin user (dependency injection).

    Returns:
        FieldResponse: The updated field record.

    Raises:
        HTTPException 404: If the field is not found.
    """
    field = db.query(Field).filter(Field.id == field_id).first()

    if not field:
        raise HTTPException(status_code=404, detail="Field not found")

    # Update fields if provided
    update_data = field_data.model_dump(exclude_unset=True)

    for field_name, value in update_data.items():
        setattr(field, field_name, value)

    try:
        db.commit()
        db.refresh(field)
        return FieldResponse.model_validate(field)
    except Exception as e:
        db.rollback()
        logger.exception("Failed to update field: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")

@router.delete("/fields/{field_id}", summary="Delete a field")
async def delete_field_global(
    field_id: UUID,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
) -> Dict[str, str]:
    """
    Delete a field.

    This endpoint soft-deletes the field by setting is_active=False, rather than
    permanently removing it from the database. This preserves historical data
    and allows for reactivation if needed.

    Args:
        field_id: The unique identifier of the field to delete.
        db: SQLAlchemy database session (dependency injection).
        admin_user: Authenticated admin user (dependency injection).

    Returns:
        Dict[str, str]: A confirmation message.

    Raises:
        HTTPException 404: If the field is not found.
    """
    field = db.query(Field).filter(Field.id == field_id).first()

    if not field:
        raise HTTPException(status_code=404, detail="Field not found")

    # Soft delete by setting is_active=False
    field.is_active = False

    try:
        db.commit()
        return {"message": "Field deleted successfully"}
    except Exception as e:
        db.rollback()
        logger.exception("Failed to delete field: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")

# League-Field Association Endpoints
@router.post("/leagues/{league_id}/fields/{field_id}", response_model=Dict[str, str], summary="Associate a field with a league")
async def associate_field_with_league(
    league_id: UUID,
    field_id: UUID,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
) -> Dict[str, str]:
    """
    Associate an existing field with a league.

    Args:
        league_id: The unique identifier of the league.
        field_id: The unique identifier of the field to associate.
        db: SQLAlchemy database session (dependency injection).
        admin_user: Authenticated admin user (dependency injection).

    Returns:
        Dict[str, str]: A confirmation message.

    Raises:
        HTTPException 404: If the league or field is not found.
        HTTPException 400: If the association already exists.
    """
    # Verify league exists
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")

    # Verify field exists
    field = db.query(Field).filter(Field.id == field_id, Field.is_active == True).first()
    if not field:
        raise HTTPException(status_code=404, detail="Field not found or not active")

    # Check if association already exists
    existing = db.query(LeagueField).filter(
        LeagueField.league_id == league_id,
        LeagueField.field_id == field_id
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Field is already associated with this league")

    # Create association
    league_field = LeagueField(
        league_id=league_id,
        field_id=field_id
    )

    try:
        db.add(league_field)
        db.commit()
        return {"message": "Field associated with league successfully"}
    except Exception as e:
        db.rollback()
        logger.exception("Failed to associate field with league: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")

@router.delete("/leagues/{league_id}/fields/{field_id}", summary="Disassociate a field from a league")
async def disassociate_field_from_league(
    league_id: UUID,
    field_id: UUID,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
) -> Dict[str, str]:
    """
    Disassociate a field from a league.

    Args:
        league_id: The unique identifier of the league.
        field_id: The unique identifier of the field to disassociate.
        db: SQLAlchemy database session (dependency injection).
        admin_user: Authenticated admin user (dependency injection).

    Returns:
        Dict[str, str]: A confirmation message.

    Raises:
        HTTPException 404: If the league or field association is not found.
    """
    # Verify league exists
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")

    # Find and remove association
    league_field = db.query(LeagueField).filter(
        LeagueField.league_id == league_id,
        LeagueField.field_id == field_id
    ).first()

    if not league_field:
        raise HTTPException(status_code=404, detail="Field is not associated with this league")

    try:
        db.delete(league_field)
        db.commit()
        return {"message": "Field disassociated from league successfully"}
    except Exception as e:
        db.rollback()
        logger.exception("Failed to disassociate field from league: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")

# League-Specific Field Endpoints (backward compatibility - uses league_fields junction table)
@router.post("/leagues/{league_id}/fields", response_model=FieldResponse, summary="Create a new field and associate it with a league")
async def create_field(
    league_id: UUID,
    field_data: FieldCreateRequest,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
) -> FieldResponse:
    """
    Create a new field and automatically associate it with the specified league.

    This is a convenience endpoint that creates a field and associates it with
    a league in one operation. The field can still be shared with other leagues later.

    Args:
        league_id: The unique identifier of the league.
        field_data: FieldCreateRequest containing field information.
        db: SQLAlchemy database session (dependency injection).
        admin_user: Authenticated admin user (dependency injection).

    Returns:
        FieldResponse: The created field record.

    Raises:
        HTTPException 404: If the league is not found.
        HTTPException 400: If validation fails.
    """
    # Verify league exists
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")

    # Create field record (no league_id needed)
    field = Field(
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
        is_active=True
    )

    try:
        db.add(field)
        db.flush()  # Get the field ID

        # Associate field with league
        league_field = LeagueField(
            league_id=league_id,
            field_id=field.id
        )
        db.add(league_field)
        db.commit()
        db.refresh(field)
        return FieldResponse.model_validate(field)
    except Exception as e:
        db.rollback()
        logger.exception("Failed to create field: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")

@router.get("/leagues/{league_id}/fields", response_model=List[FieldResponse], summary="Get all fields for a league")
async def get_fields(
    league_id: UUID,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
) -> List[FieldResponse]:
    """
    Retrieve all fields for a league.

    Args:
        league_id: The unique identifier of the league.
        is_active: Optional filter to show only active/inactive fields (default: all).
        db: SQLAlchemy database session (dependency injection).
        admin_user: Authenticated admin user (dependency injection).

    Returns:
        List[FieldResponse]: A list of fields for the league.

    Raises:
        HTTPException 404: If the league is not found.
    """
    # Verify league exists
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")

    # Get fields associated with this league via league_fields junction table
    query = db.query(Field).join(
        LeagueField, Field.id == LeagueField.field_id
    ).filter(
        LeagueField.league_id == league_id
    )

    if is_active is not None:
        query = query.filter(Field.is_active == is_active)

    fields = query.order_by(Field.name).all()

    return [FieldResponse.model_validate(field) for field in fields]

@router.get("/leagues/{league_id}/fields/{field_id}", response_model=FieldResponse, summary="Get a specific field")
async def get_field_by_id(
    league_id: UUID,
    field_id: UUID,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
) -> FieldResponse:
    """
    Retrieve a specific field by ID.

    Args:
        league_id: The unique identifier of the league.
        field_id: The unique identifier of the field.
        db: SQLAlchemy database session (dependency injection).
        admin_user: Authenticated admin user (dependency injection).

    Returns:
        FieldResponse: The field record.

    Raises:
        HTTPException 404: If the league or field is not found.
    """
    # Verify league exists
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")

    # Verify field is associated with this league
    league_field = db.query(LeagueField).filter(
        LeagueField.league_id == league_id,
        LeagueField.field_id == field_id
    ).first()

    if not league_field:
        raise HTTPException(status_code=404, detail="Field is not associated with this league")

    # Get the field
    field = db.query(Field).filter(Field.id == field_id).first()

    if not field:
        raise HTTPException(status_code=404, detail="Field not found")

    return FieldResponse.model_validate(field)

@router.put("/leagues/{league_id}/fields/{field_id}", response_model=FieldResponse, summary="Update a field")
async def update_field(
    league_id: UUID,
    field_id: UUID,
    field_data: FieldUpdateRequest,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
) -> FieldResponse:
    """
    Update an existing field.

    Args:
        league_id: The unique identifier of the league.
        field_id: The unique identifier of the field to update.
        field_data: FieldUpdateRequest containing fields to update.
                   Only provided fields will be updated.
        db: SQLAlchemy database session (dependency injection).
        admin_user: Authenticated admin user (dependency injection).

    Returns:
        FieldResponse: The updated field record.

    Raises:
        HTTPException 404: If the league or field is not found.
    """
    # Verify league exists
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")

    # Verify field is associated with this league (or allow updating any field if admin)
    # For now, we'll allow updating if the field exists (fields are global)
    field = db.query(Field).filter(Field.id == field_id).first()

    if not field:
        raise HTTPException(status_code=404, detail="Field not found")

    # Update fields if provided
    update_data = field_data.model_dump(exclude_unset=True)

    for field_name, value in update_data.items():
        setattr(field, field_name, value)

    try:
        db.commit()
        db.refresh(field)
        return FieldResponse.model_validate(field)
    except Exception as e:
        db.rollback()
        logger.exception("Failed to update field: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")

@router.delete("/leagues/{league_id}/fields/{field_id}", summary="Delete a field")
async def delete_field(
    league_id: UUID,
    field_id: UUID,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
) -> Dict[str, str]:
    """
    Delete a field.

    This endpoint soft-deletes the field by setting is_active=False, rather than
    permanently removing it from the database. This preserves historical data
    and allows for reactivation if needed.

    Args:
        league_id: The unique identifier of the league.
        field_id: The unique identifier of the field to delete.
        db: SQLAlchemy database session (dependency injection).
        admin_user: Authenticated admin user (dependency injection).

    Returns:
        Dict[str, str]: A confirmation message.

    Raises:
        HTTPException 404: If the league or field is not found.
    """
    # Note: This endpoint now disassociates the field from the league rather than deleting it
    # To delete a field globally, use DELETE /fields/{field_id}
    # Verify league exists
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")

    # Find and remove association (not the field itself)
    league_field = db.query(LeagueField).filter(
        LeagueField.league_id == league_id,
        LeagueField.field_id == field_id
    ).first()

    if not league_field:
        raise HTTPException(status_code=404, detail="Field is not associated with this league")

    try:
        db.delete(league_field)
        db.commit()
        return {"message": "Field disassociated from league successfully"}
    except Exception as e:
        db.rollback()
        logger.exception("Failed to disassociate field from league: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")

# Field Availability Management Endpoints (field-only, not league-specific)
@router.post("/field-availability", response_model=FieldAvailabilityResponse, summary="Create field availability")
async def create_field_availability_global(
    availability_data: FieldAvailabilityCreateRequest,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
) -> FieldAvailabilityResponse:
    """
    Create a new field availability record.

    Field availability is field-only (not league-specific), so it applies to
    all leagues that use the field. This endpoint allows admins to configure
    when fields are available for games.

    Supports both recurring patterns (e.g., every Tuesday 6-9pm) and custom
    one-time availability (e.g., specific dates for special events).

    Args:
        availability_data: FieldAvailabilityCreateRequest containing:
            - field_id: The ID of the field this availability is for (required)
            - is_recurring: True for recurring pattern, False for one-time
            - For recurring: day_of_week (0-6), recurrence_start_date, recurrence_end_date (optional)
            - For one-time: custom_date
            - start_time and end_time (required for both types)
            - notes (optional)
        db: SQLAlchemy database session (dependency injection).
        admin_user: Authenticated admin user (dependency injection).

    Returns:
        FieldAvailabilityResponse: The created field availability record.

    Raises:
        HTTPException 404: If the field is not found.
        HTTPException 400: If validation fails (e.g., missing required fields, invalid day_of_week).
        HTTPException 400: If end_time is not after start_time.
    """
    # Verify field exists
    field = db.query(Field).filter(
        Field.id == availability_data.field_id,
        Field.is_active == True
    ).first()
    if not field:
        raise HTTPException(status_code=404, detail="Field not found or not active")

    # Create field availability record (no league_id)
    field_availability = FieldAvailability(
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
        is_active=True
    )

    try:
        db.add(field_availability)
        db.commit()
        db.refresh(field_availability)

        # Populate field_name in response
        response = FieldAvailabilityResponse.model_validate(field_availability)
        response.field_name = field.name
        return response
    except Exception as e:
        db.rollback()
        logger.exception("Failed to create field availability: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")

@router.get("/field-availability", response_model=List[FieldAvailabilityResponse], summary="Get all field availability records")
async def get_all_field_availability(
    field_id: Optional[UUID] = None,
    is_active: Optional[bool] = None,
    skip: int = 0,
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
) -> List[FieldAvailabilityResponse]:
    """
    Retrieve all field availability records.

    Args:
        field_id: Optional filter by specific field ID.
        is_active: Optional filter to show only active/inactive records (default: all).
        skip: Number of records to skip (pagination offset).
        limit: Maximum number of records to return (pagination limit, max 500).
        db: SQLAlchemy database session (dependency injection).
        admin_user: Authenticated admin user (dependency injection).

    Returns:
        List[FieldAvailabilityResponse]: A list of field availability records.
    """
    limit = min(limit, 500)
    # Query field availability records
    query = db.query(FieldAvailability)

    if field_id is not None:
        query = query.filter(FieldAvailability.field_id == field_id)

    if is_active is not None:
        query = query.filter(FieldAvailability.is_active == is_active)

    availabilities = query.order_by(FieldAvailability.created_at.desc()).offset(skip).limit(limit).all()

    # Populate field_name for each response
    result = []
    for avail in availabilities:
        field = db.query(Field).filter(Field.id == avail.field_id).first()
        response = FieldAvailabilityResponse.model_validate(avail)
        response.field_name = field.name if field else None
        result.append(response)

    return result

@router.get("/leagues/{league_id}/field-availability", response_model=List[FieldAvailabilityResponse], summary="Get field availability for fields in a league")
async def get_field_availability_for_league(
    league_id: UUID,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
) -> List[FieldAvailabilityResponse]:
    """
    Retrieve field availability records for fields associated with a league.

    Args:
        league_id: The unique identifier of the league.
        is_active: Optional filter to show only active/inactive records (default: all).
        db: SQLAlchemy database session (dependency injection).
        admin_user: Authenticated admin user (dependency injection).

    Returns:
        List[FieldAvailabilityResponse]: A list of field availability records for fields in the league.

    Raises:
        HTTPException 404: If the league is not found.
    """
    # Verify league exists
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")

    # Get field IDs associated with this league
    field_ids_subquery = db.query(LeagueField.field_id).filter(
        LeagueField.league_id == league_id
    ).subquery()

    # Query field availability records for fields in this league
    query = db.query(FieldAvailability).filter(
        FieldAvailability.field_id.in_(select(field_ids_subquery.c.field_id))
    )

    if is_active is not None:
        query = query.filter(FieldAvailability.is_active == is_active)

    availabilities = query.order_by(FieldAvailability.created_at.desc()).all()

    # Populate field_name for each response
    result = []
    for avail in availabilities:
        field = db.query(Field).filter(Field.id == avail.field_id).first()
        response = FieldAvailabilityResponse.model_validate(avail)
        response.field_name = field.name if field else None
        result.append(response)

    return result

@router.get("/field-availability/{availability_id}", response_model=FieldAvailabilityResponse, summary="Get a specific field availability record")
async def get_field_availability_by_id(
    availability_id: UUID,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
) -> FieldAvailabilityResponse:
    """
    Retrieve a specific field availability record by ID.

    Args:
        availability_id: The unique identifier of the field availability record.
        db: SQLAlchemy database session (dependency injection).
        admin_user: Authenticated admin user (dependency injection).

    Returns:
        FieldAvailabilityResponse: The field availability record.

    Raises:
        HTTPException 404: If the field availability record is not found.
    """
    # Query field availability record
    availability = db.query(FieldAvailability).filter(
        FieldAvailability.id == availability_id
    ).first()

    if not availability:
        raise HTTPException(status_code=404, detail="Field availability record not found")

    # Populate field_name in response
    field = db.query(Field).filter(Field.id == availability.field_id).first()
    response = FieldAvailabilityResponse.model_validate(availability)
    response.field_name = field.name if field else None
    return response

@router.put("/field-availability/{availability_id}", response_model=FieldAvailabilityResponse, summary="Update field availability record")
async def update_field_availability_global(
    availability_id: UUID,
    availability_data: FieldAvailabilityUpdateRequest,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
) -> FieldAvailabilityResponse:
    """
    Update an existing field availability record.

    Args:
        availability_id: The unique identifier of the field availability record to update.
        availability_data: FieldAvailabilityUpdateRequest containing fields to update.
                           Only provided fields will be updated.
        db: SQLAlchemy database session (dependency injection).
        admin_user: Authenticated admin user (dependency injection).

    Returns:
        FieldAvailabilityResponse: The updated field availability record.

    Raises:
        HTTPException 404: If the field availability record or field is not found.
        HTTPException 400: If validation fails (e.g., invalid day_of_week, end_time <= start_time).
    """
    # Query field availability record
    availability = db.query(FieldAvailability).filter(
        FieldAvailability.id == availability_id
    ).first()

    if not availability:
        raise HTTPException(status_code=404, detail="Field availability record not found")

    # Update fields if provided
    update_data = availability_data.model_dump(exclude_unset=True)

    # Validate field_id if being updated
    if 'field_id' in update_data:
        field = db.query(Field).filter(
            Field.id == update_data['field_id'],
            Field.is_active == True
        ).first()
        if not field:
            raise HTTPException(status_code=404, detail="Field not found or not active")

    # Validate end_time > start_time if either is being updated
    if 'start_time' in update_data or 'end_time' in update_data:
        new_start_time = update_data.get('start_time', availability.start_time)
        new_end_time = update_data.get('end_time', availability.end_time)
        if new_end_time <= new_start_time:
            raise HTTPException(status_code=400, detail="end_time must be after start_time")

    # Update the record
    for field_name, value in update_data.items():
        setattr(availability, field_name, value)

    try:
        db.commit()
        db.refresh(availability)

        # Populate field_name in response
        field = db.query(Field).filter(Field.id == availability.field_id).first()
        response = FieldAvailabilityResponse.model_validate(availability)
        response.field_name = field.name if field else None
        return response
    except Exception as e:
        db.rollback()
        logger.exception("Failed to update field availability: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")

@router.delete("/field-availability/{availability_id}", summary="Delete field availability record")
async def delete_field_availability_global(
    availability_id: UUID,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
) -> Dict[str, str]:
    """
    Delete a field availability record.

    This endpoint soft-deletes the record by setting is_active=False, rather than
    permanently removing it from the database. This preserves historical data
    and allows for reactivation if needed.

    Args:
        availability_id: The unique identifier of the field availability record to delete.
        db: SQLAlchemy database session (dependency injection).
        admin_user: Authenticated admin user (dependency injection).

    Returns:
        Dict[str, str]: A confirmation message.

    Raises:
        HTTPException 404: If the field availability record is not found.
    """
    # Query field availability record
    availability = db.query(FieldAvailability).filter(
        FieldAvailability.id == availability_id
    ).first()

    if not availability:
        raise HTTPException(status_code=404, detail="Field availability record not found")

    # Soft delete by setting is_active=False
    availability.is_active = False

    try:
        db.commit()
        return {"message": "Field availability record deleted successfully"}
    except Exception as e:
        db.rollback()
        logger.exception("Failed to delete field availability: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")


# ---------------------------------------------------------------------------
# Field Availability CRUD (field-scoped)
# ---------------------------------------------------------------------------

@router.post("/fields/{field_id}/availability", response_model=FieldAvailabilityResponse, summary="Add availability window to a field")
async def create_field_availability_scoped(
    field_id: UUID,
    avail_data: FieldAvailabilityCreateRequest,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user),
):
    """Create an availability window (recurring or one-time) for a specific field."""
    field = db.query(Field).filter(Field.id == field_id, Field.is_active == True).first()
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")

    availability = FieldAvailability(
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
    db.add(availability)
    try:
        db.commit()
        db.refresh(availability)
    except Exception as e:
        db.rollback()
        logger.exception("Failed to create availability: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")

    return FieldAvailabilityResponse(
        **availability.__dict__,
        field_name=field.name,
    )


@router.get("/fields/{field_id}/availability", response_model=List[FieldAvailabilityResponse], summary="Get all availability windows for a field")
async def get_field_availability_scoped(
    field_id: UUID,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user),
):
    """Return all availability windows for a specific field."""
    field = db.query(Field).filter(Field.id == field_id).first()
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")

    availabilities = db.query(FieldAvailability).filter(
        FieldAvailability.field_id == field_id,
        FieldAvailability.is_active == True,
    ).order_by(FieldAvailability.created_at).all()

    return [
        FieldAvailabilityResponse(**a.__dict__, field_name=field.name)
        for a in availabilities
    ]


@router.put("/fields/{field_id}/availability/{avail_id}", response_model=FieldAvailabilityResponse, summary="Update a field availability window")
async def update_field_availability_scoped(
    field_id: UUID,
    avail_id: UUID,
    avail_data: FieldAvailabilityUpdateRequest,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user),
):
    """Update an existing availability window."""
    field = db.query(Field).filter(Field.id == field_id).first()
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")

    availability = db.query(FieldAvailability).filter(
        FieldAvailability.id == avail_id,
        FieldAvailability.field_id == field_id,
    ).first()
    if not availability:
        raise HTTPException(status_code=404, detail="Availability window not found")

    update_data = avail_data.model_dump(exclude_unset=True)
    for field_name, value in update_data.items():
        setattr(availability, field_name, value)

    try:
        db.commit()
        db.refresh(availability)
    except Exception as e:
        db.rollback()
        logger.exception("Failed to update availability: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")

    return FieldAvailabilityResponse(**availability.__dict__, field_name=field.name)


@router.delete("/fields/{field_id}/availability/{avail_id}", summary="Delete a field availability window")
async def delete_field_availability_scoped(
    field_id: UUID,
    avail_id: UUID,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user),
):
    """Soft-delete an availability window (sets is_active=False)."""
    availability = db.query(FieldAvailability).filter(
        FieldAvailability.id == avail_id,
        FieldAvailability.field_id == field_id,
    ).first()
    if not availability:
        raise HTTPException(status_code=404, detail="Availability window not found")

    availability.is_active = False
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.exception("Failed to delete availability: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")

    return {"message": "Availability window deleted."}
