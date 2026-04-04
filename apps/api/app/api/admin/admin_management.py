import logging

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from math import ceil

logger = logging.getLogger(__name__)
from app.core.limiter import limiter
from app.db.db import get_db
from app.models.admin_config import AdminConfig
from app.models.player import Player
from app.models.league_player import LeaguePlayer
from app.api.schemas.admin import (
    AdminConfigResponse, AdminConfigCreateRequest, AdminConfigUpdateRequest,
    UserResponse, PaginatedUserResponse
)
from app.api.admin.dependencies import get_admin_user
from app.utils.clerk_jwt import get_current_user
from app.services.admin_service import AdminService

router = APIRouter()


@router.get("/me", summary="Check if current user is an admin")
@limiter.limit("30/minute")
async def get_admin_me(request: Request, user=Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = user.get("id")
    if user_id and AdminService.is_admin_by_clerk_id(db, user_id):
        return {"is_admin": True}
    email = user.get("email", "")
    return {"is_admin": bool(email and AdminService.is_admin_email(db, email))}

@router.get("/admins", response_model=List[AdminConfigResponse], summary="Get all admin configurations")
@limiter.limit("30/minute")
async def get_admin_configs(
    request: Request,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
):
    """Get all admin email configurations"""
    admins = AdminService.get_all_admins(db)
    return [AdminConfigResponse.model_validate(admin) for admin in admins]

@router.post("/admins", response_model=AdminConfigResponse, summary="Add admin email")
@limiter.limit("30/minute")
async def add_admin_email(
    request: Request,
    admin_data: AdminConfigCreateRequest,
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
):
    """Add a new admin email address"""
    try:
        admin_config = AdminService.add_admin_email(db, admin_data.email, admin_data.role)
        db.commit()
        db.refresh(admin_config)
        return AdminConfigResponse.model_validate(admin_config)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.exception("Failed to add admin: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")

@router.put("/admins/{email:path}", response_model=AdminConfigResponse, summary="Update admin configuration")
@limiter.limit("30/minute")
async def update_admin_config(
    request: Request,
    admin_data: AdminConfigUpdateRequest,
    email: str = Path(..., max_length=320),
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
):
    """Update admin configuration"""
    try:
        if admin_data.role:
            AdminService.update_admin_role(db, email, admin_data.role)
            db.commit()

        # Get updated admin config
        admin_config = db.query(AdminConfig).filter(
            AdminConfig.email == email.lower()
        ).first()
        
        if not admin_config:
            raise HTTPException(status_code=404, detail="Admin not found")
        
        return AdminConfigResponse.model_validate(admin_config)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.exception("Failed to update admin: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")

@router.delete("/admins/{email:path}", summary="Remove admin privileges")
@limiter.limit("30/minute")
async def remove_admin_email(
    request: Request,
    email: str = Path(..., max_length=320),
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
):
    """Remove admin privileges from an email address"""
    from app.services.exceptions import ServiceError
    try:
        success = AdminService.remove_admin_email(db, email, caller_email=admin_user.get("email", ""))
        if not success:
            raise HTTPException(status_code=404, detail="Admin not found")
        db.commit()
        return {"message": "Admin privileges removed successfully."}
    except ServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.exception("Failed to remove admin: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")

@router.get("/users", response_model=PaginatedUserResponse, summary="Get all users (paginated)")
@limiter.limit("30/minute")
async def get_all_users(
    request: Request,
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(25, ge=1, le=100, description="Number of users per page"),
    db: Session = Depends(get_db),
    admin_user=Depends(get_admin_user)
):
    """Get all users with their basic information (paginated)"""
    try:
        # Get total count of active players
        total_count = db.query(func.count(Player.id)).filter(Player.is_active == True).scalar() or 0
        
        # Calculate pagination
        total_pages = ceil(total_count / page_size) if total_count > 0 else 0
        
        # Validate page number
        if page > total_pages and total_pages > 0:
            raise HTTPException(status_code=404, detail=f"Page {page} does not exist. Total pages: {total_pages}")
        
        # Get paginated players, ordered by creation date (newest first)
        offset = (page - 1) * page_size
        players = db.query(Player).filter(
            Player.is_active == True
        ).order_by(Player.created_at.desc()).offset(offset).limit(page_size).all()
        
        # Fetch league counts for all players on this page in a single query
        player_ids = [p.id for p in players]
        counts_query = (
            db.query(LeaguePlayer.player_id, func.count(LeaguePlayer.id))
            .filter(LeaguePlayer.player_id.in_(player_ids), LeaguePlayer.is_active == True)
            .group_by(LeaguePlayer.player_id)
            .all()
        )
        leagues_counts = {player_id: count for player_id, count in counts_query}

        result = []
        for player in players:
            leagues_count = leagues_counts.get(player.id, 0)

            result.append(UserResponse(
                clerk_user_id=player.clerk_user_id,
                first_name=player.first_name,
                last_name=player.last_name,
                email=player.email,
                phone=player.phone,
                date_of_birth=player.date_of_birth,
                gender=player.gender,
                created_at=player.created_at,
                leagues_count=leagues_count
            ))
        
        return PaginatedUserResponse(
            users=result,
            total=total_count,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to fetch users: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")
