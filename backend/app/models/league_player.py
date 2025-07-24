from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean
from sqlalchemy.sql import func
from app.db.db import Base

class LeaguePlayer(Base):
    __tablename__ = "league_players"
    id = Column(Integer, primary_key=True, index=True)
    league_id = Column(Integer, ForeignKey("leagues.id"), nullable=False)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    group_id = Column(Integer, ForeignKey("groups.id"), nullable=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)
    registration_status = Column(String, nullable=False, default="pending")
    payment_status = Column(String, nullable=False, default="pending")  # pending, paid, failed
    waiver_status = Column(String, nullable=False, default="pending")   # pending, signed, expired
    created_by = Column(String, nullable=False)  # Clerk user id
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now()) 