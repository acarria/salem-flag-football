from sqlalchemy import Column, String, ForeignKey, DateTime, Index, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.db.db import Base


class GroupInvitation(Base):
    __tablename__ = "group_invitations"
    __table_args__ = (
        Index("ix_group_invitations_league_id", "league_id"),
        Index("ix_group_invitations_group_id", "group_id"),
        Index("ix_group_invitations_league_status_expires", "league_id", "status", "expires_at"),
        CheckConstraint(
            "status IN ('pending', 'accepted', 'declined', 'expired', 'revoked')",
            name="ck_group_invitations_status",
        ),
    )
    id = Column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    group_id = Column(UUID(as_uuid=True), ForeignKey("groups.id"), nullable=False)
    league_id = Column(UUID(as_uuid=True), ForeignKey("leagues.id"), nullable=False)
    email = Column(String, nullable=False, index=True)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    token = Column(String, nullable=True, unique=True, index=True)
    status = Column(String, nullable=False, default="pending")  # pending | accepted | declined | expired | revoked
    invited_by = Column(UUID(as_uuid=True), ForeignKey("players.id"), nullable=False)
    player_id = Column(UUID(as_uuid=True), ForeignKey("players.id"), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    # Opt-in relationships — use joinedload() explicitly; lazy="raise" prevents accidental N+1
    group = relationship("Group", lazy="raise")
    league = relationship("League", lazy="raise")
    inviter = relationship("Player", foreign_keys=[invited_by], lazy="raise")
