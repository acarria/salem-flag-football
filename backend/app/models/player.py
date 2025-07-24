from sqlalchemy import Column, Integer, String, DateTime, Boolean, Date, ForeignKey
from sqlalchemy.sql import func
from app.db.db import Base

class Player(Base):
    __tablename__ = "players"
    id = Column(Integer, primary_key=True, index=True)
    clerk_user_id = Column(String, unique=True, index=True, nullable=False)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    date_of_birth = Column(Date, nullable=True)
    gender = Column(String, nullable=True)
    communications_accepted = Column(Boolean, default=False)
    registration_status = Column(String, default="pending")  # pending, registered, active, inactive
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)  # Which team they're on
    group_name = Column(String, nullable=True)
    registration_date = Column(DateTime(timezone=True), nullable=True)
    payment_status = Column(String, default="pending")  # pending, paid, failed
    waiver_status = Column(String, default="pending")  # pending, signed, expired
    league_id = Column(Integer, ForeignKey("leagues.id"), nullable=True)  # Which league they're registered for
    created_by = Column(String, nullable=False)  # Clerk user id
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now()) 