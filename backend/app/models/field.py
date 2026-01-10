from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, Text
from sqlalchemy.sql import func
from app.db.db import Base


class Field(Base):
    """
    Model representing a physical field/location where games can be played.
    
    Fields are independent entities that can be shared across multiple leagues.
    Each field has a unique identifier and detailed address information
    for location tracking and management.
    """
    __tablename__ = "fields"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Field identification
    name = Column(String, nullable=False)  # e.g., "Field 1", "Main Field", "North Field"
    field_number = Column(String, nullable=True)  # Optional field number/identifier
    
    # Address information
    street_address = Column(String, nullable=False)  # Street address
    city = Column(String, nullable=False)  # City
    state = Column(String, nullable=False)  # State (e.g., "MA", "Massachusetts")
    zip_code = Column(String, nullable=False)  # ZIP/Postal code
    country = Column(String, nullable=False, default="USA")  # Country
    
    # Additional location details
    facility_name = Column(String, nullable=True)  # e.g., "Salem Community Center"
    additional_notes = Column(Text, nullable=True)  # Additional location notes
    
    # Metadata
    created_by = Column(String, nullable=False)  # Clerk user id
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

