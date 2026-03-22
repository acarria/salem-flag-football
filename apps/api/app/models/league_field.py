from sqlalchemy import Column, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from app.db.db import Base


class LeagueField(Base):
    """
    Junction table for many-to-many relationship between leagues and fields.

    Allows fields to be shared across multiple leagues.
    """
    __tablename__ = "league_fields"

    id = Column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    league_id = Column(UUID(as_uuid=True), ForeignKey("leagues.id"), nullable=False, index=True)
    field_id = Column(UUID(as_uuid=True), ForeignKey("fields.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=True)

