from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, Date, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from app.db.db import Base

class Game(Base):
    __tablename__ = "games"
    __table_args__ = (
        Index("ix_games_league_active_status", "league_id", "is_active", "status"),
    )
    id = Column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    league_id = Column(UUID(as_uuid=True), ForeignKey("leagues.id"), nullable=False)
    field_id = Column(UUID(as_uuid=True), ForeignKey("fields.id"), nullable=True, index=True)
    team1_id = Column(UUID(as_uuid=True), ForeignKey("teams.id"), nullable=False)
    team2_id = Column(UUID(as_uuid=True), ForeignKey("teams.id"), nullable=False)
    week = Column(Integer, nullable=False)
    phase = Column(String, nullable=True)  # 'regular_season', 'playoff', etc.
    game_date = Column(Date, nullable=False)
    game_time = Column(String, nullable=False)  # e.g., "18:00"
    game_datetime = Column(DateTime(timezone=True), nullable=False)
    duration_minutes = Column(Integer, nullable=False, default=60)
    status = Column(String, nullable=False, default="scheduled")  # scheduled, in_progress, completed, cancelled
    team1_score = Column(Integer, nullable=True)
    team2_score = Column(Integer, nullable=True)
    winner_id = Column(UUID(as_uuid=True), ForeignKey("teams.id"), nullable=True)
    created_by = Column(String, nullable=False)  # Clerk user id
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
