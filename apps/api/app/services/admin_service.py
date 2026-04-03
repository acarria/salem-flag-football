"""Admin configuration service — module-level functions replacing the former AdminService class."""

from typing import Optional

from sqlalchemy.orm import Session

from app.models.admin_config import AdminConfig


# Preserve the AdminService name as a namespace for backward compatibility
# with callers that use AdminService.method_name() syntax.
class AdminService:
    @staticmethod
    def is_admin_email(db: Session, email: str) -> bool:
        """Check if an email address has admin privileges."""
        return is_admin_email(db, email)

    @staticmethod
    def get_admin_role(db: Session, email: str) -> Optional[str]:
        return get_admin_role(db, email)

    @staticmethod
    def add_admin_email(db: Session, email: str, role: str = "admin") -> AdminConfig:
        return add_admin_email(db, email, role)

    @staticmethod
    def remove_admin_email(db: Session, email: str) -> bool:
        return remove_admin_email(db, email)

    @staticmethod
    def get_all_admins(db: Session) -> list[AdminConfig]:
        return get_all_admins(db)

    @staticmethod
    def update_admin_role(db: Session, email: str, role: str) -> bool:
        return update_admin_role(db, email, role)


def is_admin_email(db: Session, email: str) -> bool:
    """Check if an email address has admin privileges."""
    admin_config = db.query(AdminConfig).filter(
        AdminConfig.email == email.lower(),
        AdminConfig.is_active == True
    ).first()
    return admin_config is not None


def get_admin_role(db: Session, email: str) -> Optional[str]:
    """Get the admin role for an email address."""
    admin_config = db.query(AdminConfig).filter(
        AdminConfig.email == email.lower(),
        AdminConfig.is_active == True
    ).first()
    return admin_config.role if admin_config else None


def add_admin_email(db: Session, email: str, role: str = "admin") -> AdminConfig:
    """Add a new admin email address."""
    admin_config = AdminConfig(
        email=email.lower(),
        role=role,
        is_active=True
    )
    db.add(admin_config)
    db.commit()
    db.refresh(admin_config)
    return admin_config


def remove_admin_email(db: Session, email: str) -> bool:
    """Remove admin privileges from an email address (soft delete)."""
    admin_config = db.query(AdminConfig).filter(
        AdminConfig.email == email.lower()
    ).first()

    if admin_config:
        admin_config.is_active = False
        db.commit()
        return True
    return False


def get_all_admins(db: Session) -> list[AdminConfig]:
    """Get all active admin configurations."""
    return db.query(AdminConfig).filter(AdminConfig.is_active == True).all()


def update_admin_role(db: Session, email: str, role: str) -> bool:
    """Update the role for an admin email address."""
    admin_config = db.query(AdminConfig).filter(
        AdminConfig.email == email.lower()
    ).first()

    if admin_config:
        admin_config.role = role
        db.commit()
        return True
    return False
