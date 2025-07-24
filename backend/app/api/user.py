from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.utils.clerk_jwt import get_current_user
from app.db.db import get_db
from app.models.player import Player
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

router = APIRouter()

class UserProfile(BaseModel):
    firstName: str
    lastName: str
    email: str
    phone: str
    dateOfBirth: str
    gender: str
    communicationsAccepted: bool
    registrationStatus: str
    teamId: Optional[int] = None
    groupName: Optional[str] = None
    registrationDate: Optional[str] = None
    paymentStatus: Optional[str] = None
    waiverStatus: Optional[str] = None
    leagueId: Optional[int] = None

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
            "waiverStatus": player.waiver_status,
            "leagueId": player.league_id
        }

@router.put("/profile/{user_id}", summary="Update user profile by ID")
async def update_user_profile(user_id: str, profile: UserProfile, db: Session = Depends(get_db)):
    # Check if player exists
    player = db.query(Player).filter(Player.clerk_user_id == user_id).first()
    
    if player:
        # Update existing player
        player.first_name = profile.firstName
        player.last_name = profile.lastName
        player.email = profile.email
        player.phone = profile.phone
        player.date_of_birth = datetime.strptime(profile.dateOfBirth, "%Y-%m-%d").date() if profile.dateOfBirth else None
        player.gender = profile.gender
        player.communications_accepted = profile.communicationsAccepted
        player.registration_status = profile.registrationStatus
        player.team_id = profile.teamId
        player.group_name = profile.groupName
        player.registration_date = datetime.now() if profile.registrationStatus == "registered" else player.registration_date
        player.payment_status = profile.paymentStatus
        player.waiver_status = profile.waiverStatus
        player.league_id = profile.leagueId
        player.updated_at = datetime.now()
    else:
        # Create new player
        player = Player(
            clerk_user_id=user_id,
            first_name=profile.firstName,
            last_name=profile.lastName,
            email=profile.email,
            phone=profile.phone,
            date_of_birth=datetime.strptime(profile.dateOfBirth, "%Y-%m-%d").date() if profile.dateOfBirth else None,
            gender=profile.gender,
            communications_accepted=profile.communicationsAccepted,
            registration_status=profile.registrationStatus,
            team_id=profile.teamId,
            group_name=profile.groupName,
            registration_date=datetime.now() if profile.registrationStatus == "registered" else None,
            payment_status=profile.paymentStatus,
            waiver_status=profile.waiverStatus,
            league_id=profile.leagueId,
            created_by=user_id
        )
        db.add(player)
    
    try:
        db.commit()
        db.refresh(player)
        
        # Return the updated profile
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
            "waiverStatus": player.waiver_status,
            "leagueId": player.league_id
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update profile: {str(e)}") 