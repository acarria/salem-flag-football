from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.utils.clerk_jwt import get_current_user
from app.db.db import get_db
from app.models.player import Player
from app.models.league import League
from app.models.league_player import LeaguePlayer
from app.models.group import Group
from app.api.schemas.registration import (
    SoloRegistrationRequest, GroupRegistrationRequest,
    RegistrationResponse, LeagueRegistrationResponse
)
from datetime import datetime
from typing import Optional

router = APIRouter()

@router.post("/player", response_model=RegistrationResponse, summary="Register a player for a league (solo registration)")
async def register_player(
    registration_data: SoloRegistrationRequest,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
) -> RegistrationResponse:
    """
    Register a player for a league (solo registration).
    
    This endpoint:
    1. Creates or updates the player's profile
    2. Creates a LeaguePlayer entry linking the player to the league
    3. Optionally creates/links a group if groupName is provided
    
    Args:
        registration_data: SoloRegistrationRequest containing player information and league_id.
        user: Authenticated user from Clerk (dependency injection).
        db: SQLAlchemy database session (dependency injection).
    
    Returns:
        RegistrationResponse: Confirmation of successful registration with registration details.
    
    Raises:
        HTTPException 404: If the league is not found.
        HTTPException 400: If the player is already registered for this league.
        HTTPException 400: If validation fails (e.g., terms not accepted).
    """
    clerk_user_id = user.get("id") or user.get("user_id")
    if not clerk_user_id:
        raise HTTPException(status_code=401, detail="User ID not found in authentication token")
    
    # Verify league exists
    league = db.query(League).filter(League.id == registration_data.league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    
    # Check if league is accepting registrations
    if not league.is_active:
        raise HTTPException(status_code=400, detail="League is not currently active")
    
    if league.registration_deadline and league.registration_deadline < datetime.now().date():
        raise HTTPException(status_code=400, detail="Registration deadline has passed")
    
    # Parse date of birth
    try:
        date_of_birth = datetime.strptime(registration_data.dateOfBirth, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid date format for dateOfBirth: {registration_data.dateOfBirth}. Expected format: YYYY-MM-DD"
        )
    
    # Get or create player profile
    player = db.query(Player).filter(Player.clerk_user_id == clerk_user_id).first()
    
    if player:
        # Update existing player profile
        player.first_name = registration_data.firstName
        player.last_name = registration_data.lastName
        player.email = registration_data.email
        player.phone = registration_data.phone
        player.date_of_birth = date_of_birth
        player.gender = registration_data.gender if registration_data.gender else None
        player.communications_accepted = registration_data.communicationsAccepted
        player.updated_at = datetime.now()
    else:
        # Create new player profile
        player = Player(
            clerk_user_id=clerk_user_id,
            first_name=registration_data.firstName,
            last_name=registration_data.lastName,
            email=registration_data.email,
            phone=registration_data.phone,
            date_of_birth=date_of_birth,
            gender=registration_data.gender if registration_data.gender else None,
            communications_accepted=registration_data.communicationsAccepted,
            registration_status="pending",
            payment_status="pending",
            waiver_status="pending",
            created_by=clerk_user_id
        )
        db.add(player)
        db.flush()  # Get player.id
    
    # Check if player is already registered for this league
    existing_registration = db.query(LeaguePlayer).filter(
        LeaguePlayer.league_id == registration_data.league_id,
        LeaguePlayer.player_id == player.id,
        LeaguePlayer.is_active == True
    ).first()
    
    if existing_registration:
        raise HTTPException(
            status_code=400,
            detail="You are already registered for this league"
        )
    
    # Handle group if provided
    group_id = None
    if registration_data.groupName:
        # Check if group exists for this league with this name
        group = db.query(Group).filter(
            Group.league_id == registration_data.league_id,
            Group.name == registration_data.groupName,
            Group.is_active == True
        ).first()
        
        if not group:
            # Create new group
            group = Group(
                league_id=registration_data.league_id,
                name=registration_data.groupName,
                created_by=player.id,
                created_by_clerk=clerk_user_id
            )
            db.add(group)
            db.flush()
        
        group_id = group.id
    
    # Create LeaguePlayer entry (this is the actual registration)
    league_player = LeaguePlayer(
        league_id=registration_data.league_id,
        player_id=player.id,
        group_id=group_id,
        registration_status="pending",
        payment_status="pending",
        waiver_status="pending",
        created_by=clerk_user_id
    )
    db.add(league_player)
    
    try:
        db.commit()
        db.refresh(league_player)
        
        # Get league name for response
        league_name = league.name
        
        return RegistrationResponse(
            success=True,
            message=f"Successfully registered for {league_name}",
            registration=LeagueRegistrationResponse(
                id=league_player.id,
                league_id=league_player.league_id,
                league_name=league_name,
                player_id=league_player.player_id,
                registration_status=league_player.registration_status,
                payment_status=league_player.payment_status,
                waiver_status=league_player.waiver_status,
                team_id=league_player.team_id,
                group_id=league_player.group_id,
                group_name=registration_data.groupName if registration_data.groupName else None,
                created_at=league_player.created_at.isoformat(),
                updated_at=league_player.updated_at.isoformat()
            ),
            player_id=player.id
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to register: {str(e)}")

@router.post("/group", response_model=RegistrationResponse, summary="Register a group of players for a league")
async def register_group(
    registration_data: GroupRegistrationRequest,
    user=Depends(get_current_user),
    db: Session = Depends(get_db)
) -> RegistrationResponse:
    """
    Register a group of players for a league.
    
    This endpoint:
    1. Creates or updates player profiles for all players in the group
    2. Creates a Group entry
    3. Creates LeaguePlayer entries for each player, all linked to the same group
    
    Args:
        registration_data: GroupRegistrationRequest containing group information and player list.
        user: Authenticated user from Clerk (dependency injection).
        db: SQLAlchemy database session (dependency injection).
    
    Returns:
        RegistrationResponse: Confirmation of successful group registration.
    
    Raises:
        HTTPException 404: If the league is not found.
        HTTPException 400: If any player is already registered for this league.
        HTTPException 400: If validation fails.
    """
    clerk_user_id = user.get("id") or user.get("user_id")
    if not clerk_user_id:
        raise HTTPException(status_code=401, detail="User ID not found in authentication token")
    
    # Verify league exists
    league = db.query(League).filter(League.id == registration_data.league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    
    # Check if league is accepting registrations
    if not league.is_active:
        raise HTTPException(status_code=400, detail="League is not currently active")
    
    if league.registration_deadline and league.registration_deadline < datetime.now().date():
        raise HTTPException(status_code=400, detail="Registration deadline has passed")
    
    # Get the primary user's player record (the one creating the group)
    primary_player = db.query(Player).filter(Player.clerk_user_id == clerk_user_id).first()
    if not primary_player:
        raise HTTPException(
            status_code=400,
            detail="You must have a player profile before creating a group. Please register solo first."
        )
    
    # Create the group
    group = Group(
        league_id=registration_data.league_id,
        name=registration_data.groupName,
        created_by=primary_player.id,
        created_by_clerk=clerk_user_id
    )
    db.add(group)
    db.flush()  # Get group.id
    
    # Register each player in the group
    registered_players = []
    for player_info in registration_data.players:
        # Find or create player by email
        player = db.query(Player).filter(Player.email == player_info.email.lower()).first()
        
        if not player:
            # Create new player (they'll need to complete their profile later)
            player = Player(
                clerk_user_id=None,  # Will be set when they sign up
                first_name=player_info.firstName,
                last_name=player_info.lastName,
                email=player_info.email.lower(),
                communications_accepted=registration_data.communicationsAccepted,
                registration_status="pending",
                payment_status="pending",
                waiver_status="pending",
                created_by=clerk_user_id
            )
            db.add(player)
            db.flush()
        
        # Check if player is already registered for this league
        existing_registration = db.query(LeaguePlayer).filter(
            LeaguePlayer.league_id == registration_data.league_id,
            LeaguePlayer.player_id == player.id,
            LeaguePlayer.is_active == True
        ).first()
        
        if existing_registration:
            # Skip this player but continue with others
            continue
        
        # Create LeaguePlayer entry
        league_player = LeaguePlayer(
            league_id=registration_data.league_id,
            player_id=player.id,
            group_id=group.id,
            registration_status="pending",
            payment_status="pending",
            waiver_status="pending",
            created_by=clerk_user_id
        )
        db.add(league_player)
        registered_players.append(player)
    
    if not registered_players:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="All players in the group are already registered for this league"
        )
    
    try:
        db.commit()
        db.refresh(group)
        
        return RegistrationResponse(
            success=True,
            message=f"Successfully registered group '{registration_data.groupName}' with {len(registered_players)} players for {league.name}",
            player_id=primary_player.id
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to register group: {str(e)}")

@router.get("/player/{user_id}/leagues", response_model=list[LeagueRegistrationResponse], summary="Get all league registrations for a player")
async def get_player_registrations(
    user_id: str,
    db: Session = Depends(get_db)
) -> list[LeagueRegistrationResponse]:
    """
    Get all league registrations for a specific player.
    
    Args:
        user_id: Clerk user ID of the player.
        db: SQLAlchemy database session (dependency injection).
    
    Returns:
        List[LeagueRegistrationResponse]: List of all active league registrations for the player.
    """
    # Get player
    player = db.query(Player).filter(Player.clerk_user_id == user_id).first()
    if not player:
        return []
    
    # Get all active league registrations
    registrations = db.query(LeaguePlayer).filter(
        LeaguePlayer.player_id == player.id,
        LeaguePlayer.is_active == True
    ).all()
    
    result = []
    for reg in registrations:
        # Get league name
        league = db.query(League).filter(League.id == reg.league_id).first()
        league_name = league.name if league else None
        
        # Get group name if applicable
        group_name = None
        if reg.group_id:
            group = db.query(Group).filter(Group.id == reg.group_id).first()
            group_name = group.name if group else None
        
        result.append(LeagueRegistrationResponse(
            id=reg.id,
            league_id=reg.league_id,
            league_name=league_name,
            player_id=reg.player_id,
            registration_status=reg.registration_status,
            payment_status=reg.payment_status,
            waiver_status=reg.waiver_status,
            team_id=reg.team_id,
            group_id=reg.group_id,
            group_name=group_name,
            created_at=reg.created_at.isoformat(),
            updated_at=reg.updated_at.isoformat()
        ))
    
    return result 