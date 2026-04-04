from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.db import get_db
from app.utils.clerk_jwt import get_current_user
from app.services.admin_service import AdminService


async def get_admin_user(
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Check if the authenticated user has admin privileges.

    Tries clerk_user_id first (immutable), falls back to email.
    """
    user_id = user.get("id")
    if user_id and AdminService.is_admin_by_clerk_id(db, user_id):
        return user
    user_email = user.get("email")
    if not user_email or not AdminService.is_admin_email(db, user_email):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
