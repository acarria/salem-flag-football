from sqlalchemy import Column, Integer, String, Date, DateTime, Boolean, Text, JSON, Numeric, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from app.db.db import Base

class League(Base):
    __tablename__ = "leagues"
    __table_args__ = (
        CheckConstraint("format IN ('7v7', '5v5')", name="ck_leagues_format"),
        CheckConstraint("max_teams IS NULL OR (max_teams >= 2 AND max_teams <= 10)", name="ck_leagues_max_teams"),
    )
    id = Column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)  # Calculated based on format and num_weeks
    num_weeks = Column(Integer, nullable=False)
    format = Column(String, nullable=False)  # '7v7' or '5v5' (see ck_leagues_format)
    
    # Tournament format settings
    tournament_format = Column(String, nullable=False, default='round_robin')  # 'round_robin', 'swiss'

    # Swiss tournament settings
    swiss_rounds = Column(Integer, nullable=True)  # Number of rounds for Swiss tournament
    swiss_pairing_method = Column(String, nullable=True)  # 'buchholz', 'sonneborn_berger', etc.
    
    # Game settings
    game_duration = Column(Integer, nullable=False, default=60)  # Minutes per game
    games_per_week = Column(Integer, nullable=False, default=1)  # Number of games per team per week
    max_teams = Column(Integer, nullable=True)  # Maximum number of teams allowed
    min_teams = Column(Integer, nullable=False, default=4)  # Minimum number of teams to start
    
    # Registration settings
    registration_deadline = Column(Date, nullable=True)  # When registration closes
    registration_fee = Column(Numeric(10, 2), nullable=False, default=0)  # Registration fee in dollars
    
    # Advanced settings stored as JSON
    settings = Column(JSON, nullable=True)  # Flexible settings for future features
    
    created_by = Column(String, nullable=False)  # Clerk user id
    is_active = Column(Boolean, default=True)
    deadline_processed_at = Column(DateTime(timezone=True), nullable=True)  # Idempotency guard for deadline handler
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now()) 