from sqlalchemy import Column, String, Text, DateTime, Boolean, ForeignKey, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from app.db.db import Base


class Waiver(Base):
    __tablename__ = "waivers"

    id = Column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    version = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    is_active = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class WaiverSignature(Base):
    __tablename__ = "waiver_signatures"
    __table_args__ = (
        UniqueConstraint(
            "player_id", "league_id", "waiver_id",
            name="uq_signature_player_league_waiver",
        ),
        Index("ix_waiver_signatures_waiver_id", "waiver_id"),
        Index("ix_waiver_signatures_player_id", "player_id"),
        Index("ix_waiver_signatures_league_id", "league_id"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    waiver_id = Column(UUID(as_uuid=True), ForeignKey("waivers.id"), nullable=False)
    player_id = Column(UUID(as_uuid=True), ForeignKey("players.id"), nullable=False)
    league_id = Column(UUID(as_uuid=True), ForeignKey("leagues.id"), nullable=False)
    full_name_typed = Column(String, nullable=False)
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    signed_at = Column(DateTime(timezone=True), server_default=func.now())
    email_sent_at = Column(DateTime(timezone=True), nullable=True)
    pdf_path = Column(String, nullable=True)
