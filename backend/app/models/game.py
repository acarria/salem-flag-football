from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, Date
from sqlalchemy.sql import func
from app.db.db import Base

class Game(Base):
    __tablename__ = "games"
    id = Column(Integer, primary_key=True, index=True)
    league_id = Column(Integer, ForeignKey("leagues.id"), nullable=False)
    field_id = Column(Integer, ForeignKey("fields.id"), nullable=True, index=True)
    team1_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    team2_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    week = Column(Integer, nullable=False)
    phase = Column(String, nullable=True)  # 'regular_season', 'playoff', etc.
    game_date = Column(Date, nullable=False)
    game_time = Column(String, nullable=False)  # e.g., "18:00"
    game_datetime = Column(DateTime, nullable=False)
    duration_minutes = Column(Integer, nullable=False, default=60)
    status = Column(String, nullable=False, default="scheduled")  # scheduled, in_progress, completed, cancelled
    team1_score = Column(Integer, nullable=True)
    team2_score = Column(Integer, nullable=True)
    winner_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    created_by = Column(String, nullable=False)  # Clerk user id
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())
