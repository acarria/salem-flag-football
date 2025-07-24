from sqlalchemy.orm import Session
from app.models.admin_config import AdminConfig
from typing import Optional

class AdminService:
    @staticmethod
    def is_admin_email(db: Session, email: str) -> bool:
        """Check if an email address has admin privileges"""
        admin_config = db.query(AdminConfig).filter(
            AdminConfig.email == email.lower(),
            AdminConfig.is_active == True
        ).first()
        return admin_config is not None

    @staticmethod
    def get_admin_role(db: Session, email: str) -> Optional[str]:
        """Get the admin role for an email address"""
        admin_config = db.query(AdminConfig).filter(
            AdminConfig.email == email.lower(),
            AdminConfig.is_active == True
        ).first()
        return admin_config.role if admin_config else None

    @staticmethod
    def add_admin_email(db: Session, email: str, role: str = "admin") -> AdminConfig:
        """Add a new admin email address"""
        admin_config = AdminConfig(
            email=email.lower(),
            role=role,
            is_active=True
        )
        db.add(admin_config)
        db.commit()
        db.refresh(admin_config)
        return admin_config

    @staticmethod
    def remove_admin_email(db: Session, email: str) -> bool:
        """Remove admin privileges from an email address (soft delete)"""
        admin_config = db.query(AdminConfig).filter(
            AdminConfig.email == email.lower()
        ).first()
        
        if admin_config:
            admin_config.is_active = False
            db.commit()
            return True
        return False

    @staticmethod
    def get_all_admins(db: Session) -> list[AdminConfig]:
        """Get all active admin configurations"""
        return db.query(AdminConfig).filter(AdminConfig.is_active == True).all()

    @staticmethod
    def update_admin_role(db: Session, email: str, role: str) -> bool:
        """Update the role for an admin email address"""
        admin_config = db.query(AdminConfig).filter(
            AdminConfig.email == email.lower()
        ).first()
        
        if admin_config:
            admin_config.role = role
            db.commit()
            return True
        return False 