import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.utils.clerk_jwt import get_current_user
from app.db.db import get_db
from app.models.player import Player
from app.models.league_player import LeaguePlayer
from app.api.schemas.user import UserProfile
from datetime import datetime
from uuid import UUID

logger = logging.getLogger(__name__)

router = APIRouter()


def _player_to_dict(player: Player) -> dict:
    return {
        "firstName": player.first_name,
        "lastName": player.last_name,
        "email": player.email,
        "phone": player.phone or "",
        "dateOfBirth": player.date_of_birth.isoformat() if player.date_of_birth else "",
        "gender": player.gender or "",
        "communicationsAccepted": player.communications_accepted,
        "registrationDate": player.registration_date.isoformat() if player.registration_date else None,
        "paymentStatus": player.payment_status,
        "waiverStatus": player.waiver_status,
    }


def _upsert_player(player: Player | None, user_id: str, profile: UserProfile, db: Session) -> Player:
    """Create or update a Player record from a UserProfile. Does not commit."""
    if profile.dateOfBirth and profile.dateOfBirth.strip():
        try:
            date_of_birth = datetime.strptime(profile.dateOfBirth, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid date format for dateOfBirth: {profile.dateOfBirth}. Expected format: YYYY-MM-DD",
            )
    else:
        date_of_birth = None

    if player:
        player.first_name = profile.firstName
        player.last_name = profile.lastName
        player.email = profile.email
        player.phone = profile.phone
        player.date_of_birth = date_of_birth
        player.gender = profile.gender if profile.gender else None
        player.communications_accepted = profile.communicationsAccepted
        player.payment_status = profile.paymentStatus if profile.paymentStatus else "pending"
        player.waiver_status = profile.waiverStatus if profile.waiverStatus else "pending"
        player.updated_at = datetime.now()
    else:
        player = Player(
            clerk_user_id=user_id,
            first_name=profile.firstName,
            last_name=profile.lastName,
            email=profile.email,
            phone=profile.phone,
            date_of_birth=date_of_birth,
            gender=profile.gender if profile.gender else None,
            communications_accepted=profile.communicationsAccepted,
            payment_status=profile.paymentStatus if profile.paymentStatus else "pending",
            waiver_status=profile.waiverStatus if profile.waiverStatus else "pending",
            created_by=user_id,
        )
        db.add(player)
    return player


@router.get("/me", summary="Get current user profile")
async def get_my_profile(user=Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = user.get("id")
    player = db.query(Player).filter(Player.clerk_user_id == user_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Profile not found")
    return _player_to_dict(player)


@router.put("/me", summary="Update current user profile")
async def update_my_profile(profile: UserProfile, user=Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = user.get("id")
    player = db.query(Player).filter(Player.clerk_user_id == user_id).first()
    player = _upsert_player(player, user_id, profile, db)
    try:
        db.commit()
        db.refresh(player)
        return _player_to_dict(player)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.exception("Failed to update profile for user %s: %s", user_id, e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")


@router.get("/profile/{user_id}", summary="Get user profile by ID")
async def get_user_profile(user_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    if user.get("id") != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    player = db.query(Player).filter(Player.clerk_user_id == user_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Profile not found")
    return _player_to_dict(player)


@router.get("/profile/{user_id}/registered/{league_id}", summary="Check if user is registered for a league")
async def check_league_registration(
    user_id: str, league_id: UUID, user=Depends(get_current_user), db: Session = Depends(get_db)
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
async def update_user_profile(
    user_id: str, profile: UserProfile, user=Depends(get_current_user), db: Session = Depends(get_db)
):
    if user.get("id") != user_id:
        raise HTTPException(status_code=403, detail="Forbidden")
    player = db.query(Player).filter(Player.clerk_user_id == user_id).first()
    player = _upsert_player(player, user_id, profile, db)
    try:
        db.commit()
        db.refresh(player)
        return _player_to_dict(player)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.exception("Failed to update profile for user %s: %s", user_id, e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")
