from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.db import get_db
from app.utils.clerk_session import get_current_user_from_session
from app.services.admin_service import AdminService

async def get_admin_user(
    user=Depends(get_current_user_from_session),
    db: Session = Depends(get_db)
):
    """Check if the authenticated user has admin privileges"""
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Get user's email from session data
    user_email = user.get('email')
    if not user_email:
        raise HTTPException(status_code=403, detail="Email address required for admin access")
    
    # Check if user's email is in admin config
    if not AdminService.is_admin_email(db, user_email):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return user
