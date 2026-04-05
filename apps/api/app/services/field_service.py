import logging
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.field import Field
from app.models.field_availability import FieldAvailability
from app.models.league import League
from app.models.league_field import LeagueField
from app.services.exceptions import NotFoundError, ConflictError, ServiceError

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Field CRUD
# ---------------------------------------------------------------------------


def create_field(
    db: Session,
    *,
    name: str,
    field_number: Optional[str] = None,
    street_address: str,
    city: str,
    state: str,
    zip_code: str,
    country: str = "USA",
    facility_name: Optional[str] = None,
    additional_notes: Optional[str] = None,
    created_by: str,
) -> Field:
    """Create a new field and flush to obtain its ID."""
    field = Field(
        name=name,
        field_number=field_number,
        street_address=street_address,
        city=city,
        state=state,
        zip_code=zip_code,
        country=country,
        facility_name=facility_name,
        additional_notes=additional_notes,
        created_by=created_by,
    )
    db.add(field)
    db.flush()
    return field


def get_field(db: Session, field_id: UUID) -> Field:
    """Return a field by ID or raise NotFoundError."""
    field = db.query(Field).filter(Field.id == field_id).first()
    if not field:
        raise NotFoundError("Field not found")
    return field


def list_fields(
    db: Session, *, is_active: Optional[bool] = None
) -> list[Field]:
    """Return all fields ordered by name, optionally filtered by active status."""
    query = db.query(Field)
    if is_active is not None:
        query = query.filter(Field.is_active == is_active)
    return query.order_by(Field.name).all()


def update_field(db: Session, field_id: UUID, **updates) -> Field:
    """Apply keyword updates to a field and return it."""
    field = get_field(db, field_id)
    for key, value in updates.items():
        setattr(field, key, value)
    return field


def soft_delete_field(db: Session, field_id: UUID) -> None:
    """Mark a field as inactive."""
    field = get_field(db, field_id)
    field.is_active = False


# ---------------------------------------------------------------------------
# League ↔ Field association
# ---------------------------------------------------------------------------


def associate_field_to_league(
    db: Session, league_id: UUID, field_id: UUID
) -> LeagueField:
    """Link a field to a league. Raises on missing entities or duplicate."""
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise NotFoundError("League not found")

    field = get_field(db, field_id)
    if not field.is_active:
        raise NotFoundError("Field not found")

    existing = (
        db.query(LeagueField)
        .filter(
            LeagueField.league_id == league_id,
            LeagueField.field_id == field_id,
        )
        .first()
    )
    if existing:
        raise ConflictError("Field is already associated with this league")

    league_field = LeagueField(league_id=league_id, field_id=field_id)
    db.add(league_field)
    db.flush()
    return league_field


def disassociate_field_from_league(
    db: Session, league_id: UUID, field_id: UUID
) -> None:
    """Remove the link between a field and a league."""
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise NotFoundError("League not found")

    league_field = (
        db.query(LeagueField)
        .filter(
            LeagueField.league_id == league_id,
            LeagueField.field_id == field_id,
        )
        .first()
    )
    if not league_field:
        raise NotFoundError("Field is not associated with this league")

    db.delete(league_field)


def get_league_fields(
    db: Session, league_id: UUID, *, is_active: Optional[bool] = None
) -> list[Field]:
    """Return all fields linked to a league, ordered by name."""
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise NotFoundError("League not found")

    query = (
        db.query(Field)
        .join(LeagueField, LeagueField.field_id == Field.id)
        .filter(LeagueField.league_id == league_id)
    )
    if is_active is not None:
        query = query.filter(Field.is_active == is_active)
    return query.order_by(Field.name).all()


def create_field_and_associate(
    db: Session,
    league_id: UUID,
    *,
    created_by: str,
    **field_kwargs,
) -> Field:
    """Create a field and immediately associate it with a league."""
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise NotFoundError("League not found")

    field = create_field(db, created_by=created_by, **field_kwargs)
    db.flush()

    league_field = LeagueField(league_id=league_id, field_id=field.id)
    db.add(league_field)
    db.flush()
    return field


# ---------------------------------------------------------------------------
# Field availability
# ---------------------------------------------------------------------------


def create_availability(
    db: Session,
    *,
    field_id: UUID,
    is_recurring: bool = False,
    day_of_week: Optional[int] = None,
    recurrence_start_date=None,
    recurrence_end_date=None,
    custom_date=None,
    start_time,
    end_time,
    notes: Optional[str] = None,
    created_by: str,
) -> FieldAvailability:
    """Create a new availability window for a field."""
    field = get_field(db, field_id)
    if not field.is_active:
        raise NotFoundError("Field not found")

    availability = FieldAvailability(
        field_id=field_id,
        is_recurring=is_recurring,
        day_of_week=day_of_week,
        recurrence_start_date=recurrence_start_date,
        recurrence_end_date=recurrence_end_date,
        custom_date=custom_date,
        start_time=start_time,
        end_time=end_time,
        notes=notes,
        created_by=created_by,
    )
    db.add(availability)
    db.flush()
    return availability


def list_availabilities(
    db: Session,
    *,
    field_id: Optional[UUID] = None,
    is_active: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
) -> list[FieldAvailability]:
    """Return availability records with optional filters and pagination."""
    query = db.query(FieldAvailability)
    if field_id is not None:
        query = query.filter(FieldAvailability.field_id == field_id)
    if is_active is not None:
        query = query.filter(FieldAvailability.is_active == is_active)
    return (
        query.order_by(FieldAvailability.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def list_league_availabilities(
    db: Session, league_id: UUID, *, is_active: Optional[bool] = None
) -> list[FieldAvailability]:
    """Return availability records for all fields linked to a league."""
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise NotFoundError("League not found")

    field_ids_subquery = (
        db.query(LeagueField.field_id)
        .filter(LeagueField.league_id == league_id)
        .subquery()
    )

    query = db.query(FieldAvailability).filter(
        FieldAvailability.field_id.in_(field_ids_subquery)
    )
    if is_active is not None:
        query = query.filter(FieldAvailability.is_active == is_active)
    return query.all()


def get_availability(db: Session, availability_id: UUID) -> FieldAvailability:
    """Return an availability record by ID or raise NotFoundError."""
    availability = (
        db.query(FieldAvailability)
        .filter(FieldAvailability.id == availability_id)
        .first()
    )
    if not availability:
        raise NotFoundError("Field availability not found")
    return availability


def update_availability(
    db: Session, availability_id: UUID, **updates
) -> FieldAvailability:
    """Apply keyword updates to an availability record."""
    availability = get_availability(db, availability_id)

    # If changing field, verify the new field exists and is active
    new_field_id = updates.get("field_id")
    if new_field_id is not None and new_field_id != availability.field_id:
        field = get_field(db, new_field_id)
        if not field.is_active:
            raise NotFoundError("Field not found")

    # If changing time window, validate end > start
    start_time = updates.get("start_time", availability.start_time)
    end_time = updates.get("end_time", availability.end_time)
    if "start_time" in updates or "end_time" in updates:
        if end_time <= start_time:
            raise ServiceError("end_time must be after start_time")

    for key, value in updates.items():
        setattr(availability, key, value)
    return availability


def soft_delete_availability(db: Session, availability_id: UUID) -> None:
    """Mark an availability record as inactive."""
    availability = get_availability(db, availability_id)
    availability.is_active = False


# ---------------------------------------------------------------------------
# Scoped lookups (field + its availabilities)
# ---------------------------------------------------------------------------


def get_field_availability_scoped(
    db: Session, field_id: UUID
) -> tuple[Field, list[FieldAvailability]]:
    """Return a field and its active availability records."""
    field = get_field(db, field_id)
    availabilities = (
        db.query(FieldAvailability)
        .filter(
            FieldAvailability.field_id == field_id,
            FieldAvailability.is_active == True,  # noqa: E712
        )
        .all()
    )
    return field, availabilities


def get_scoped_availability(
    db: Session, field_id: UUID, avail_id: UUID
) -> tuple[Field, FieldAvailability]:
    """Return a field and a specific availability that belongs to it."""
    field = get_field(db, field_id)
    availability = (
        db.query(FieldAvailability)
        .filter(
            FieldAvailability.id == avail_id,
            FieldAvailability.field_id == field_id,
        )
        .first()
    )
    if not availability:
        raise NotFoundError("Field availability not found")
    return field, availability
