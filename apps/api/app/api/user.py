import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, Request
from sqlalchemy.orm import Session

from app.api.schemas.user import UserProfile, UserProfileResponse
from app.db.db import get_db
from app.models.league_player import LeaguePlayer
from app.models.player import Player
from app.services.exceptions import ServiceError
import app.services.player_service as player_svc
from app.core.limiter import limiter
from app.utils.clerk_jwt import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()


def _build_profile_response(player: Player) -> UserProfileResponse:
    return UserProfileResponse(
        first_name=player.first_name,
        last_name=player.last_name,
        email=player.email,
        phone=player.phone or "",
        date_of_birth=player.date_of_birth,
        gender=player.gender or "",
        communications_accepted=player.communications_accepted,
        registration_date=player.registration_date.isoformat() if player.registration_date else None,
    )


@router.get("/me", response_model=UserProfileResponse, summary="Get current user profile")
@limiter.limit("30/minute")
async def get_my_profile(request: Request, user=Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = user.get("id")
    player = db.query(Player).filter(Player.clerk_user_id == user_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Profile not found")
    return _build_profile_response(player)


@router.put("/me", response_model=UserProfileResponse, summary="Update current user profile")
@limiter.limit("10/minute")
async def update_my_profile(request: Request, profile: UserProfile, user=Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = user.get("id")
    try:
        player = player_svc.upsert_player(
            db, user_id,
            first_name=profile.first_name, last_name=profile.last_name,
            email=profile.email, phone=profile.phone,
            date_of_birth=profile.date_of_birth,
            gender=profile.gender if profile.gender else None,
            communications_accepted=profile.communications_accepted,
        )
        db.commit()
        db.refresh(player)
        return _build_profile_response(player)
    except ServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        db.rollback()
        logger.exception("Failed to update profile for user %s: %s", user_id, e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")


@router.get("/profile/{user_id}", response_model=UserProfileResponse, summary="Get user profile by ID")
@limiter.limit("30/minute")
async def get_user_profile(request: Request, user_id: str = Path(..., max_length=200), user=Depends(get_current_user), db: Session = Depends(get_db)):
    if user.get("id") != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    player = db.query(Player).filter(Player.clerk_user_id == user_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Profile not found")
    return _build_profile_response(player)


@router.get("/profile/{user_id}/registered/{league_id}", summary="Check if user is registered for a league")
@limiter.limit("30/minute")
async def check_league_registration(
    request: Request, user_id: str = Path(..., max_length=200), *, league_id: UUID, user=Depends(get_current_user), db: Session = Depends(get_db)
):
    if user.get("id") != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    player = db.query(Player).filter(Player.clerk_user_id == user_id).first()
    if not player:
        return {"is_registered": False}
    existing_league_player = db.query(LeaguePlayer).filter(
        LeaguePlayer.league_id == league_id,
        LeaguePlayer.player_id == player.id,
        LeaguePlayer.is_active == True,
    ).first()
    return {"is_registered": existing_league_player is not None}


@router.put("/profile/{user_id}", response_model=UserProfileResponse, summary="Update user profile by ID")
@limiter.limit("10/minute")
async def update_user_profile(
    request: Request, user_id: str = Path(..., max_length=200), *, profile: UserProfile, user=Depends(get_current_user), db: Session = Depends(get_db)
):
    if user.get("id") != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    try:
        player = player_svc.upsert_player(
            db, user_id,
            first_name=profile.first_name, last_name=profile.last_name,
            email=profile.email, phone=profile.phone,
            date_of_birth=profile.date_of_birth,
            gender=profile.gender if profile.gender else None,
            communications_accepted=profile.communications_accepted,
        )
        db.commit()
        db.refresh(player)
        return _build_profile_response(player)
    except ServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        db.rollback()
        logger.exception("Failed to update profile for user %s: %s", user_id, e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")
