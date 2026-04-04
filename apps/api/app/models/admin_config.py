from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
from app.db.db import Base

class AdminConfig(Base):
    __tablename__ = "admin_configs"
    id = Column(UUID(as_uuid=True), primary_key=True, index=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    clerk_user_id = Column(String, nullable=True, unique=True, index=True)
    is_active = Column(Boolean, default=True)
    role = Column(String, default="admin")  # admin, super_admin, etc.
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now()) 