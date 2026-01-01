from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db.db import get_db
from app.models.admin_config import AdminConfig
from app.api.schemas.admin import (
    AdminConfigResponse, AdminConfigCreateRequest, AdminConfigUpdateRequest
)
from app.api.admin.dependencies import get_admin_user
from app.services.admin_service import AdminService

router = APIRouter()

@router.get("/admins", response_model=List[AdminConfigResponse], summary="Get all admin configurations")
async def get_admin_configs(
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
):
    """Get all admin email configurations"""
    admins = AdminService.get_all_admins(db)
    return [AdminConfigResponse.from_orm(admin) for admin in admins]

@router.post("/admins", response_model=AdminConfigResponse, summary="Add admin email")
async def add_admin_email(
    admin_data: AdminConfigCreateRequest,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
):
    """Add a new admin email address"""
    try:
        admin_config = AdminService.add_admin_email(db, admin_data.email, admin_data.role)
        return AdminConfigResponse.from_orm(admin_config)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to add admin: {str(e)}")

@router.put("/admins/{email}", response_model=AdminConfigResponse, summary="Update admin configuration")
async def update_admin_config(
    email: str,
    admin_data: AdminConfigUpdateRequest,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
):
    """Update admin configuration"""
    try:
        if admin_data.role:
            AdminService.update_admin_role(db, email, admin_data.role)
        
        # Get updated admin config
        admin_config = db.query(AdminConfig).filter(
            AdminConfig.email == email.lower()
        ).first()
        
        if not admin_config:
            raise HTTPException(status_code=404, detail="Admin not found")
        
        return AdminConfigResponse.from_orm(admin_config)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update admin: {str(e)}")

@router.delete("/admins/{email}", summary="Remove admin privileges")
async def remove_admin_email(
    email: str,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
):
    """Remove admin privileges from an email address"""
    try:
        success = AdminService.remove_admin_email(db, email)
        if not success:
            raise HTTPException(status_code=404, detail="Admin not found")
        return {"message": f"Admin privileges removed from {email}"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to remove admin: {str(e)}")
