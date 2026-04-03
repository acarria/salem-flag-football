from sqlalchemy import Column, String, DateTime, Boolean, Date
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from app.db.db import Base

class Player(Base):
    __tablename__ = "players"
    id = Column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    clerk_user_id = Column(String, unique=True, index=True, nullable=False)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    date_of_birth = Column(Date, nullable=True)
    gender = Column(String, nullable=True)
    communications_accepted = Column(Boolean, default=False)
    registration_date = Column(DateTime(timezone=True), nullable=True)
    payment_status = Column(String, default="pending")  # pending, paid, failed
    waiver_status = Column(String, default="pending")  # pending, signed, expired
    created_by = Column(String, nullable=False)  # Clerk user id
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now()) 