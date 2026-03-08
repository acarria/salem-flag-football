from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.utils.clerk_jwt import get_current_user
from app.db.db import get_db
from app.models.player import Player
from app.models.league_player import LeaguePlayer
from app.api.schemas.user import UserProfile
from typing import Optional
from datetime import datetime
from uuid import UUID

router = APIRouter()

@router.get("/me", summary="Get current user profile")
async def get_profile(user=Depends(get_current_user)):
    # TODO: Optionally fetch/sync user from DB
    return {"user": user}

@router.put("/me", summary="Update current user profile")
async def update_profile(data: dict, user=Depends(get_current_user)):
    # TODO: Update user profile in DB
    return {"message": "Profile updated", "user": user}

@router.get("/profile/{user_id}", summary="Get user profile by ID")
async def get_user_profile(user_id: str, db: Session = Depends(get_db)):
    """
    Get a user's profile information.
    
    Note: This endpoint returns the player's base profile.
    
    Args:
        user_id: Clerk user ID of the player.
        db: SQLAlchemy database session (dependency injection).
    
    Returns:
        UserProfile: The player's profile information, or None if profile doesn't exist.
    """
    # Fetch profile from DB
    player = db.query(Player).filter(Player.clerk_user_id == user_id).first()
    
    if not player:
        # Return None to indicate no profile exists
        return None
    
    return {
        "firstName": player.first_name,
        "lastName": player.last_name,
        "email": player.email,
        "phone": player.phone or "",
        "dateOfBirth": player.date_of_birth.isoformat() if player.date_of_birth else "",
        "gender": player.gender or "",
        "communicationsAccepted": player.communications_accepted,
        "registrationStatus": player.registration_status,
        "teamId": player.team_id,
        "groupName": player.group_name,
        "registrationDate": player.registration_date.isoformat() if player.registration_date else None,
        "paymentStatus": player.payment_status,
        "waiverStatus": player.waiver_status
    }

@router.get("/profile/{user_id}/registered/{league_id}", summary="Check if user is registered for a league")
async def check_league_registration(user_id: str, league_id: UUID, db: Session = Depends(get_db)):
    """
    Check if a user is already registered for a specific league.
    
    This endpoint checks the LeaguePlayer table for active registrations.
    
    Args:
        user_id: Clerk user ID of the player.
        league_id: ID of the league to check registration for.
        db: SQLAlchemy database session (dependency injection).
    
    Returns:
        Dict with "isRegistered" boolean indicating registration status.
    """
    player = db.query(Player).filter(Player.clerk_user_id == user_id).first()
    
    if not player:
        return {"isRegistered": False}
    
    # Check if there's an active LeaguePlayer entry
    existing_league_player = db.query(LeaguePlayer).filter(
        LeaguePlayer.league_id == league_id,
        LeaguePlayer.player_id == player.id,
        LeaguePlayer.is_active == True
    ).first()
    
    return {"isRegistered": existing_league_player is not None}

@router.put("/profile/{user_id}", summary="Update user profile by ID")
async def update_user_profile(user_id: str, profile: UserProfile, db: Session = Depends(get_db)):
    """
    Update a user's profile information.
    
    Note: This endpoint only updates the player's base profile.
    
    Args:
        user_id: Clerk user ID of the player.
        profile: UserProfile containing updated profile information.
        db: SQLAlchemy database session (dependency injection).
    
    Returns:
        UserProfile: The updated profile information.
    
    Raises:
        HTTPException 400: If date format is invalid.
        HTTPException 500: If database update fails.
    """
    # Check if player exists
    player = db.query(Player).filter(Player.clerk_user_id == user_id).first()
    
    if player:
        # Update existing player
        player.first_name = profile.firstName
        player.last_name = profile.lastName
        player.email = profile.email
        player.phone = profile.phone
        # Handle dateOfBirth - convert empty string to None, or parse valid date
        if profile.dateOfBirth and profile.dateOfBirth.strip():
            try:
                player.date_of_birth = datetime.strptime(profile.dateOfBirth, "%Y-%m-%d").date()
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid date format for dateOfBirth: {profile.dateOfBirth}. Expected format: YYYY-MM-DD"
                )
        else:
            player.date_of_birth = None
        player.gender = profile.gender if profile.gender else None
        player.communications_accepted = profile.communicationsAccepted
        player.registration_status = profile.registrationStatus if profile.registrationStatus else "pending"
        player.team_id = profile.teamId
        player.group_name = profile.groupName
        player.registration_date = datetime.now() if profile.registrationStatus == "registered" else player.registration_date
        player.payment_status = profile.paymentStatus if profile.paymentStatus else "pending"
        player.waiver_status = profile.waiverStatus if profile.waiverStatus else "pending"
        # Note: league_id is no longer updated here - use registration endpoints
        player.updated_at = datetime.now()
    else:
        # Create new player (profile only, no league registration)
        # Handle dateOfBirth - convert empty string to None, or parse valid date
        date_of_birth = None
        if profile.dateOfBirth and profile.dateOfBirth.strip():
            try:
                date_of_birth = datetime.strptime(profile.dateOfBirth, "%Y-%m-%d").date()
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid date format for dateOfBirth: {profile.dateOfBirth}. Expected format: YYYY-MM-DD"
                )
        
        player = Player(
            clerk_user_id=user_id,
            first_name=profile.firstName,
            last_name=profile.lastName,
            email=profile.email,
            phone=profile.phone,
            date_of_birth=date_of_birth,
            gender=profile.gender if profile.gender else None,
            communications_accepted=profile.communicationsAccepted,
            registration_status=profile.registrationStatus if profile.registrationStatus else "pending",
            team_id=profile.teamId,
            group_name=profile.groupName,
            registration_date=datetime.now() if profile.registrationStatus == "registered" else None,
            payment_status=profile.paymentStatus if profile.paymentStatus else "pending",
            waiver_status=profile.waiverStatus if profile.waiverStatus else "pending",
            # Note: league_id is not set - use registration endpoints to register for leagues
            created_by=user_id
        )
        db.add(player)
    
    try:
        db.commit()
        db.refresh(player)
        
        # Return the updated profile (without leagueId)
        return {
            "firstName": player.first_name,
            "lastName": player.last_name,
            "email": player.email,
            "phone": player.phone or "",
            "dateOfBirth": player.date_of_birth.isoformat() if player.date_of_birth else "",
            "gender": player.gender or "",
            "communicationsAccepted": player.communications_accepted,
            "registrationStatus": player.registration_status,
            "teamId": player.team_id,
            "groupName": player.group_name,
            "registrationDate": player.registration_date.isoformat() if player.registration_date else None,
            "paymentStatus": player.payment_status,
            "waiverStatus": player.waiver_status
        }
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update profile: {str(e)}") 