import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.db import get_db
from app.models.group import Group
from app.models.group_invitation import GroupInvitation
from app.models.league import League
from app.models.league_player import LeaguePlayer
from app.models.player import Player
from app.api.schemas.registration import (
    SoloRegistrationRequest,
    GroupRegistrationRequest,
    RegistrationResponse,
    LeagueRegistrationResponse,
    InvitationDetailResponse,
    PendingInvitationResponse,
)
from app.utils.clerk_jwt import get_current_user

router = APIRouter()


# ---------------------------------------------------------------------------
# Solo registration
# ---------------------------------------------------------------------------

@router.post("/player", response_model=RegistrationResponse, summary="Register a player for a league (solo)")
async def register_player(
    registration_data: SoloRegistrationRequest,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RegistrationResponse:
    clerk_user_id = user.get("id") or user.get("user_id")
    if not clerk_user_id:
        raise HTTPException(status_code=401, detail="User ID not found in authentication token")

    league = db.query(League).filter(League.id == registration_data.league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    if not league.is_active:
        raise HTTPException(status_code=400, detail="League is not currently active")
    if league.registration_deadline and league.registration_deadline < datetime.now().date():
        raise HTTPException(status_code=400, detail="Registration deadline has passed")

    try:
        date_of_birth = datetime.strptime(registration_data.dateOfBirth, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid date format for dateOfBirth: {registration_data.dateOfBirth}. Expected format: YYYY-MM-DD",
        )

    player = db.query(Player).filter(Player.clerk_user_id == clerk_user_id).first()
    if player:
        player.first_name = registration_data.firstName
        player.last_name = registration_data.lastName
        player.email = registration_data.email
        player.phone = registration_data.phone
        player.date_of_birth = date_of_birth
        player.gender = registration_data.gender if registration_data.gender else None
        player.communications_accepted = registration_data.communicationsAccepted
        player.updated_at = datetime.now()
    else:
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
            created_by=clerk_user_id,
        )
        db.add(player)
        db.flush()

    existing = db.query(LeaguePlayer).filter(
        LeaguePlayer.league_id == registration_data.league_id,
        LeaguePlayer.player_id == player.id,
        LeaguePlayer.is_active == True,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="You are already registered for this league")

    group_id = None
    if registration_data.groupName:
        group = db.query(Group).filter(
            Group.league_id == registration_data.league_id,
            Group.name == registration_data.groupName,
            Group.is_active == True,
        ).first()
        if not group:
            group = Group(
                league_id=registration_data.league_id,
                name=registration_data.groupName,
                created_by=player.id,
                created_by_clerk=clerk_user_id,
            )
            db.add(group)
            db.flush()
        group_id = group.id

    league_player = LeaguePlayer(
        league_id=registration_data.league_id,
        player_id=player.id,
        group_id=group_id,
        registration_status="pending",
        payment_status="pending",
        waiver_status="pending",
        created_by=clerk_user_id,
    )
    db.add(league_player)

    try:
        db.commit()
        db.refresh(league_player)
        return RegistrationResponse(
            success=True,
            message=f"Successfully registered for {league.name}",
            registration=LeagueRegistrationResponse(
                id=league_player.id,
                league_id=league_player.league_id,
                league_name=league.name,
                player_id=league_player.player_id,
                registration_status=league_player.registration_status,
                payment_status=league_player.payment_status,
                waiver_status=league_player.waiver_status,
                team_id=league_player.team_id,
                group_id=league_player.group_id,
                group_name=registration_data.groupName if registration_data.groupName else None,
                created_at=league_player.created_at.isoformat(),
                updated_at=league_player.updated_at.isoformat(),
            ),
            player_id=player.id,
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to register: {str(e)}")


# ---------------------------------------------------------------------------
# Group registration (invitation-based)
# ---------------------------------------------------------------------------

@router.post("/group", response_model=RegistrationResponse, summary="Register a group — organizer confirmed, invitees emailed")
async def register_group(
    registration_data: GroupRegistrationRequest,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RegistrationResponse:
    """
    Creates the group and immediately confirms the organizer's registration.
    Each entry in `players` (invitees) gets a GroupInvitation record and an
    invitation email.  No LeaguePlayer rows are created for invitees until
    they explicitly accept via /registration/invite/{token}/accept.
    """
    clerk_user_id = user.get("id") or user.get("user_id")
    if not clerk_user_id:
        raise HTTPException(status_code=401, detail="User ID not found in authentication token")

    league = db.query(League).filter(League.id == registration_data.league_id).first()
    if not league:
        raise HTTPException(status_code=404, detail="League not found")
    if not league.is_active:
        raise HTTPException(status_code=400, detail="League is not currently active")
    if league.registration_deadline and league.registration_deadline < datetime.now().date():
        raise HTTPException(status_code=400, detail="Registration deadline has passed")

    organizer = db.query(Player).filter(Player.clerk_user_id == clerk_user_id).first()
    if not organizer:
        raise HTTPException(
            status_code=400,
            detail="You must complete your player profile before creating a group.",
        )

    # Check organizer not already in this league
    existing = db.query(LeaguePlayer).filter(
        LeaguePlayer.league_id == registration_data.league_id,
        LeaguePlayer.player_id == organizer.id,
        LeaguePlayer.is_active == True,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="You are already registered for this league")

    # Create the group
    group = Group(
        league_id=registration_data.league_id,
        name=registration_data.groupName,
        created_by=organizer.id,
        created_by_clerk=clerk_user_id,
    )
    db.add(group)
    db.flush()

    # Confirm organizer registration
    organizer_lp = LeaguePlayer(
        league_id=registration_data.league_id,
        player_id=organizer.id,
        group_id=group.id,
        registration_status="confirmed",
        payment_status="pending",
        waiver_status="pending",
        created_by=clerk_user_id,
    )
    db.add(organizer_lp)

    # Create invitations for each invitee (no LeaguePlayer yet)
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    invitations_created = 0
    for invitee in registration_data.players:
        invitation = GroupInvitation(
            group_id=group.id,
            league_id=registration_data.league_id,
            email=invitee.email.lower(),
            first_name=invitee.firstName,
            last_name=invitee.lastName,
            token=secrets.token_urlsafe(32),
            status="pending",
            invited_by=organizer.id,
            expires_at=expires_at,
        )
        db.add(invitation)
        invitations_created += 1

    try:
        db.commit()
        db.refresh(group)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to register group: {str(e)}")

    # Send invitation emails (best-effort — don't roll back if email fails)
    if settings.RESEND_API_KEY:
        from app.services.email_service import send_group_invitation
        invitations = db.query(GroupInvitation).filter(
            GroupInvitation.group_id == group.id,
            GroupInvitation.status == "pending",
        ).all()
        organizer_name = f"{organizer.first_name} {organizer.last_name}"
        for inv in invitations:
            try:
                send_group_invitation(
                    to_email=inv.email,
                    to_name=f"{inv.first_name} {inv.last_name}",
                    inviter_name=organizer_name,
                    group_name=registration_data.groupName,
                    league_name=league.name,
                    token=inv.token,
                    app_url=settings.APP_URL,
                )
            except Exception:
                pass  # Email failure is non-fatal

    return RegistrationResponse(
        success=True,
        message=(
            f"Group '{registration_data.groupName}' created for {league.name}. "
            f"You are confirmed. {invitations_created} invitation(s) sent."
        ),
        player_id=organizer.id,
    )


# ---------------------------------------------------------------------------
# Invitation endpoints
# ---------------------------------------------------------------------------

@router.get("/invite/{token}", response_model=InvitationDetailResponse, summary="Get invitation details (public)")
async def get_invitation(token: str, db: Session = Depends(get_db)) -> InvitationDetailResponse:
    inv = db.query(GroupInvitation).filter(GroupInvitation.token == token).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found")

    # Mark as expired if past expiry date
    if inv.status == "pending" and inv.expires_at < datetime.now(timezone.utc):
        inv.status = "expired"
        db.commit()

    group = db.query(Group).filter(Group.id == inv.group_id).first()
    league = db.query(League).filter(League.id == inv.league_id).first()
    inviter = db.query(Player).filter(Player.id == inv.invited_by).first()

    return InvitationDetailResponse(
        token=inv.token,
        group_id=inv.group_id,
        group_name=group.name if group else "",
        league_id=inv.league_id,
        league_name=league.name if league else "",
        inviter_name=f"{inviter.first_name} {inviter.last_name}" if inviter else "",
        invitee_first_name=inv.first_name,
        invitee_last_name=inv.last_name,
        invitee_email=inv.email,
        status=inv.status,
        expires_at=inv.expires_at.isoformat(),
    )


@router.post("/invite/{token}/accept", summary="Accept a group invitation (authenticated)")
async def accept_invitation(
    token: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    clerk_user_id = user.get("id") or user.get("user_id")
    if not clerk_user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    inv = db.query(GroupInvitation).filter(GroupInvitation.token == token).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found")
    if inv.status != "pending":
        raise HTTPException(status_code=400, detail=f"Invitation is already {inv.status}")
    if inv.expires_at < datetime.now(timezone.utc):
        inv.status = "expired"
        db.commit()
        raise HTTPException(status_code=400, detail="Invitation has expired")

    # Get or create the accepting player's record
    player = db.query(Player).filter(Player.clerk_user_id == clerk_user_id).first()
    if not player:
        raise HTTPException(
            status_code=400,
            detail="Please complete your player profile before accepting an invitation.",
        )

    # Check not already registered
    existing = db.query(LeaguePlayer).filter(
        LeaguePlayer.league_id == inv.league_id,
        LeaguePlayer.player_id == player.id,
        LeaguePlayer.is_active == True,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="You are already registered for this league")

    league_player = LeaguePlayer(
        league_id=inv.league_id,
        player_id=player.id,
        group_id=inv.group_id,
        registration_status="confirmed",
        payment_status="pending",
        waiver_status="pending",
        created_by=clerk_user_id,
    )
    db.add(league_player)

    inv.status = "accepted"
    inv.player_id = player.id

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to accept invitation: {str(e)}")

    return {"success": True, "message": "Invitation accepted. You are now registered for the league."}


@router.post("/invite/{token}/decline", summary="Decline a group invitation")
async def decline_invitation(token: str, db: Session = Depends(get_db)):
    inv = db.query(GroupInvitation).filter(GroupInvitation.token == token).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invitation not found")
    if inv.status != "pending":
        raise HTTPException(status_code=400, detail=f"Invitation is already {inv.status}")

    inv.status = "declined"
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to decline invitation: {str(e)}")

    return {"success": True, "message": "Invitation declined."}


@router.get("/invitations/me", response_model=list[PendingInvitationResponse], summary="Get pending invitations for the current user")
async def get_my_invitations(
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[PendingInvitationResponse]:
    clerk_user_id = user.get("id") or user.get("user_id")
    if not clerk_user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    # Get the user's email from their player record
    player = db.query(Player).filter(Player.clerk_user_id == clerk_user_id).first()
    if not player:
        return []

    now = datetime.now(timezone.utc)
    invitations = db.query(GroupInvitation).filter(
        GroupInvitation.email == player.email.lower(),
        GroupInvitation.status == "pending",
        GroupInvitation.expires_at > now,
    ).all()

    result = []
    for inv in invitations:
        group = db.query(Group).filter(Group.id == inv.group_id).first()
        league = db.query(League).filter(League.id == inv.league_id).first()
        inviter = db.query(Player).filter(Player.id == inv.invited_by).first()
        result.append(PendingInvitationResponse(
            token=inv.token,
            group_name=group.name if group else "",
            league_name=league.name if league else "",
            inviter_name=f"{inviter.first_name} {inviter.last_name}" if inviter else "",
            expires_at=inv.expires_at.isoformat(),
        ))

    return result


# ---------------------------------------------------------------------------
# Unregister from a league
# ---------------------------------------------------------------------------

@router.delete("/leagues/{league_id}", summary="Unregister the current player from a league")
async def unregister_from_league(
    league_id: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    clerk_user_id = user.get("id") or user.get("user_id")
    if not clerk_user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")

    player = db.query(Player).filter(Player.clerk_user_id == clerk_user_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Registration not found")

    league_player = db.query(LeaguePlayer).filter(
        LeaguePlayer.league_id == league_id,
        LeaguePlayer.player_id == player.id,
        LeaguePlayer.is_active == True,
    ).first()
    if not league_player:
        raise HTTPException(status_code=404, detail="Registration not found")

    if league_player.team_id is not None:
        raise HTTPException(
            status_code=409,
            detail="Teams have already been assigned; contact the league admin to be removed.",
        )

    league_player.is_active = False
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to unregister: {str(e)}")

    return {"success": True, "message": "You have been unregistered from the league."}


# ---------------------------------------------------------------------------
# Player registration history
# ---------------------------------------------------------------------------

@router.get("/player/{user_id}/leagues", response_model=list[LeagueRegistrationResponse], summary="Get all league registrations for a player")
async def get_player_registrations(
    user_id: str,
    db: Session = Depends(get_db),
) -> list[LeagueRegistrationResponse]:
    player = db.query(Player).filter(Player.clerk_user_id == user_id).first()
    if not player:
        return []

    registrations = db.query(LeaguePlayer).filter(
        LeaguePlayer.player_id == player.id,
        LeaguePlayer.is_active == True,
    ).all()

    result = []
    for reg in registrations:
        league = db.query(League).filter(League.id == reg.league_id).first()
        group_name = None
        if reg.group_id:
            group = db.query(Group).filter(Group.id == reg.group_id).first()
            group_name = group.name if group else None
        result.append(LeagueRegistrationResponse(
            id=reg.id,
            league_id=reg.league_id,
            league_name=league.name if league else None,
            player_id=reg.player_id,
            registration_status=reg.registration_status,
            payment_status=reg.payment_status,
            waiver_status=reg.waiver_status,
            team_id=reg.team_id,
            group_id=reg.group_id,
            group_name=group_name,
            created_at=reg.created_at.isoformat(),
            updated_at=reg.updated_at.isoformat(),
        ))

    return result
