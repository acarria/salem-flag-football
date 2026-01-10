from sqlalchemy import Column, Integer, String, Date, Time, ForeignKey, DateTime, Boolean
from sqlalchemy.sql import func
from app.db.db import Base


class FieldAvailability(Base):
    """
    Model representing field availability for a specific field.
    
    Supports both recurring patterns (e.g., every Tuesday 6-9pm) and custom
    one-time availability windows (e.g., specific dates for special events).
    Each availability record is tied to a specific field and applies globally
    (not league-specific).
    """
    __tablename__ = "field_availabilities"
    
    id = Column(Integer, primary_key=True, index=True)
    field_id = Column(Integer, ForeignKey("fields.id"), nullable=False, index=True)
    
    # Type of availability
    is_recurring = Column(Boolean, nullable=False, default=False)
    
    # For recurring availability
    day_of_week = Column(Integer, nullable=True)  # 0=Monday, 6=Sunday (ISO weekday)
    recurrence_start_date = Column(Date, nullable=True)  # When recurring pattern starts
    recurrence_end_date = Column(Date, nullable=True)  # When recurring pattern ends (None = indefinite)
    
    # For custom one-time availability
    custom_date = Column(Date, nullable=True)  # Specific date for one-time availability
    
    # Time window (applies to both recurring and custom)
    start_time = Column(Time, nullable=False)  # e.g., 18:00 (6pm)
    end_time = Column(Time, nullable=False)  # e.g., 21:00 (9pm)
    
    # Metadata
    notes = Column(String, nullable=True)  # Optional notes (e.g., "Subject to city approval")
    created_by = Column(String, nullable=False)  # Clerk user id
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

