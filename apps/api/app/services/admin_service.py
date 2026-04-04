"""Admin configuration service — module-level functions with TTL cache."""

import time
from typing import Optional

from sqlalchemy.orm import Session

from app.models.admin_config import AdminConfig

# Simple TTL cache for is_admin lookups. Per-Lambda-instance; reset on cold start.
_admin_cache: dict[str, tuple[bool, float]] = {}
_CACHE_TTL = 300  # 5 minutes


def _invalidate_cache(email: str | None = None) -> None:
    """Clear cache for a specific email or the entire cache."""
    if email:
        _admin_cache.pop(email.lower(), None)
    else:
        _admin_cache.clear()


# Preserve the AdminService name as a namespace for backward compatibility
# with callers that use AdminService.method_name() syntax.
class AdminService:
    @staticmethod
    def is_admin_email(db: Session, email: str) -> bool:
        return is_admin_email(db, email)

    @staticmethod
    def is_admin_by_clerk_id(db: Session, clerk_user_id: str) -> bool:
        return is_admin_by_clerk_id(db, clerk_user_id)

    @staticmethod
    def get_admin_role(db: Session, email: str) -> Optional[str]:
        return get_admin_role(db, email)

    @staticmethod
    def add_admin_email(db: Session, email: str, role: str = "admin", clerk_user_id: str | None = None) -> AdminConfig:
        return add_admin_email(db, email, role, clerk_user_id)

    @staticmethod
    def remove_admin_email(db: Session, email: str, caller_email: str = "") -> bool:
        return remove_admin_email(db, email, caller_email)

    @staticmethod
    def get_all_admins(db: Session) -> list[AdminConfig]:
        return get_all_admins(db)

    @staticmethod
    def update_admin_role(db: Session, email: str, role: str) -> bool:
        return update_admin_role(db, email, role)


def is_admin_email(db: Session, email: str) -> bool:
    """Check if an email address has admin privileges. Uses TTL cache."""
    key = email.lower()
    now = time.monotonic()

    cached = _admin_cache.get(key)
    if cached is not None:
        result, ts = cached
        if now - ts < _CACHE_TTL:
            return result

    admin_config = db.query(AdminConfig).filter(
        AdminConfig.email == key,
        AdminConfig.is_active == True
    ).first()
    result = admin_config is not None
    _admin_cache[key] = (result, now)
    return result


def is_admin_by_clerk_id(db: Session, clerk_user_id: str) -> bool:
    """Check if a Clerk user ID has admin privileges."""
    if not clerk_user_id:
        return False
    admin_config = db.query(AdminConfig).filter(
        AdminConfig.clerk_user_id == clerk_user_id,
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


def add_admin_email(db: Session, email: str, role: str = "admin", clerk_user_id: str | None = None) -> AdminConfig:
    """Add a new admin email address. Does NOT commit — caller owns the transaction."""
    admin_config = AdminConfig(
        email=email.lower(),
        role=role,
        is_active=True,
    )
    if clerk_user_id:
        admin_config.clerk_user_id = clerk_user_id
    db.add(admin_config)
    db.flush()
    _invalidate_cache(email)
    return admin_config


def remove_admin_email(db: Session, email: str, caller_email: str = "") -> bool:
    """Remove admin privileges from an email address (soft delete).

    Does NOT commit — caller owns the transaction.

    Raises ServiceError if:
    - The caller is trying to remove themselves
    - This would remove the last active admin
    """
    from app.services.exceptions import ServiceError

    if caller_email and email.lower() == caller_email.lower():
        raise ServiceError("Cannot remove your own admin privileges", status_code=400)

    active_count = db.query(AdminConfig).filter(AdminConfig.is_active == True).count()
    if active_count <= 1:
        raise ServiceError("Cannot remove the last remaining admin", status_code=400)

    admin_config = db.query(AdminConfig).filter(
        AdminConfig.email == email.lower()
    ).first()

    if admin_config:
        admin_config.is_active = False
        _invalidate_cache(email)
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
        _invalidate_cache(email)
        return True
    return False
