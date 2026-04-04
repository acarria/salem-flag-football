import logging
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, Request
from sqlalchemy.orm import Session

from app.api.schemas.user import UserProfile
from app.db.db import get_db
from app.models.league_player import LeaguePlayer
from app.models.player import Player
from app.services.exceptions import ServiceError
from app.services.player_service import upsert_player
from app.core.limiter import limiter
from app.utils.clerk_jwt import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()


def _player_to_dict(player: Player) -> dict:
    return {
        "firstName": player.first_name,
        "lastName": player.last_name,
        "email": player.email,
        "phone": player.phone or "",
        "dateOfBirth": player.date_of_birth.isoformat() if player.date_of_birth else None,
        "gender": player.gender or "",
        "communicationsAccepted": player.communications_accepted,
        "registrationDate": player.registration_date.isoformat() if player.registration_date else None,
    }


def _parse_dob(raw: str | None):
    """Parse dateOfBirth string, returning date or None."""
    if not raw or not raw.strip():
        return None
    try:
        return datetime.strptime(raw, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid date format for dateOfBirth. Expected format: YYYY-MM-DD",
        )


@router.get("/me", summary="Get current user profile")
@limiter.limit("30/minute")
async def get_my_profile(request: Request, user=Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = user.get("id")
    player = db.query(Player).filter(Player.clerk_user_id == user_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Profile not found")
    return _player_to_dict(player)


@router.put("/me", summary="Update current user profile")
@limiter.limit("10/minute")
async def update_my_profile(request: Request, profile: UserProfile, user=Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = user.get("id")
    dob = _parse_dob(profile.dateOfBirth)
    try:
        player = upsert_player(
            db, user_id,
            first_name=profile.firstName, last_name=profile.lastName,
            email=profile.email, phone=profile.phone,
            date_of_birth=dob,
            gender=profile.gender if profile.gender else None,
            communications_accepted=profile.communicationsAccepted,
        )
        db.commit()
        db.refresh(player)
        return _player_to_dict(player)
    except ServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        db.rollback()
        logger.exception("Failed to update profile for user %s: %s", user_id, e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")


@router.get("/profile/{user_id}", summary="Get user profile by ID")
@limiter.limit("30/minute")
async def get_user_profile(request: Request, user_id: str = Path(..., max_length=200), user=Depends(get_current_user), db: Session = Depends(get_db)):
    if user.get("id") != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    player = db.query(Player).filter(Player.clerk_user_id == user_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Profile not found")
    return _player_to_dict(player)


@router.get("/profile/{user_id}/registered/{league_id}", summary="Check if user is registered for a league")
@limiter.limit("30/minute")
async def check_league_registration(
    request: Request, user_id: str = Path(..., max_length=200), *, league_id: UUID, user=Depends(get_current_user), db: Session = Depends(get_db)
):
    if user.get("id") != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    player = db.query(Player).filter(Player.clerk_user_id == user_id).first()
    if not player:
        return {"isRegistered": False}
    existing_league_player = db.query(LeaguePlayer).filter(
        LeaguePlayer.league_id == league_id,
        LeaguePlayer.player_id == player.id,
        LeaguePlayer.is_active == True,
    ).first()
    return {"isRegistered": existing_league_player is not None}


@router.put("/profile/{user_id}", summary="Update user profile by ID")
@limiter.limit("10/minute")
async def update_user_profile(
    request: Request, user_id: str = Path(..., max_length=200), *, profile: UserProfile, user=Depends(get_current_user), db: Session = Depends(get_db)
):
    if user.get("id") != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    dob = _parse_dob(profile.dateOfBirth)
    try:
        player = upsert_player(
            db, user_id,
            first_name=profile.firstName, last_name=profile.lastName,
            email=profile.email, phone=profile.phone,
            date_of_birth=dob,
            gender=profile.gender if profile.gender else None,
            communications_accepted=profile.communicationsAccepted,
        )
        db.commit()
        db.refresh(player)
        return _player_to_dict(player)
    except ServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        db.rollback()
        logger.exception("Failed to update profile for user %s: %s", user_id, e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")
