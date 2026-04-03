from sqlalchemy import Column, String, ForeignKey, DateTime, Boolean, Index, CheckConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from app.db.db import Base

class LeaguePlayer(Base):
    __tablename__ = "league_players"
    __table_args__ = (
        Index("ix_league_players_league_id", "league_id"),
        Index("ix_league_players_player_id", "player_id"),
        Index("ix_league_players_group_id", "group_id"),
        Index("ix_league_players_league_regstatus_active", "league_id", "registration_status", "is_active"),
        Index("ix_league_players_league_player", "league_id", "player_id", unique=True,
              postgresql_where=text("is_active = TRUE")),
        CheckConstraint(
            "registration_status IN ('confirmed', 'pending', 'declined', 'expired')",
            name="ck_league_players_registration_status",
        ),
    )
    id = Column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    league_id = Column(UUID(as_uuid=True), ForeignKey("leagues.id"), nullable=False)
    player_id = Column(UUID(as_uuid=True), ForeignKey("players.id"), nullable=False)
    group_id = Column(UUID(as_uuid=True), ForeignKey("groups.id"), nullable=True)
    team_id = Column(UUID(as_uuid=True), ForeignKey("teams.id"), nullable=True)
    registration_status = Column(String, nullable=False, default="pending")
    payment_status = Column(String, nullable=False, default="pending")  # pending, paid, failed
    waiver_status = Column(String, nullable=False, default="pending")   # pending, signed, expired
    created_by = Column(String, nullable=False)  # Clerk user id
    is_active = Column(Boolean, default=True)
    waiver_deadline = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())