from sqlalchemy import Column, Integer, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.db.db import Base


class LeagueField(Base):
    """
    Junction table for many-to-many relationship between leagues and fields.
    
    Allows fields to be shared across multiple leagues.
    """
    __tablename__ = "league_fields"
    
    id = Column(Integer, primary_key=True, index=True)
    league_id = Column(Integer, ForeignKey("leagues.id"), nullable=False, index=True)
    field_id = Column(Integer, ForeignKey("fields.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=True)

