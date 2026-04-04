"""Registration API — thin HTTP adapter over service layer.

Each endpoint handles: rate limiting, auth, request parsing, response building.
Domain logic lives in services/registration_service.py and services/invitation_service.py.
"""

import asyncio
import functools
import logging
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.limiter import limiter
from app.db.db import get_db
from app.models.league import League
from app.models.player import Player
from app.utils.clerk_jwt import get_current_user
from app.services.exceptions import ServiceError
from app.services.email_service import send_group_invitation, send_waiver_prompt
from app.services.team_generation_service import trigger_team_generation_if_ready
import app.services.registration_service as registration_svc
import app.services.invitation_service as invitation_svc
from app.api.schemas.registration import (
    GroupMemberDetail,
    GroupRegistrationRequest,
    InvitationDetailResponse,
    LeagueRegistrationResponse,
    MyGroupResponse,
    MyTeamResponse,
    PendingInvitationResponse,
    RegistrationResponse,
    SoloRegistrationRequest,
    SuccessResponse,
    TeamMemberPublic,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_clerk_id(user: dict) -> str:
    cid = user.get("id")
    if not cid:
        raise HTTPException(status_code=401, detail="User ID not found in authentication token")
    return cid


# ---------------------------------------------------------------------------
# Solo registration
# ---------------------------------------------------------------------------

@router.post("/player", response_model=RegistrationResponse, summary="Register a player for a league (solo)")
@limiter.limit("10/minute")
async def register_player(
    request: Request,
    registration_data: SoloRegistrationRequest,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RegistrationResponse:
    clerk_user_id = _get_clerk_id(user)

    try:
        result = registration_svc.register_solo(
            db,
            clerk_user_id,
            league_id=registration_data.league_id,
            first_name=registration_data.firstName,
            last_name=registration_data.lastName,
            email=registration_data.email,
            phone=registration_data.phone,
            date_of_birth=registration_data.dateOfBirth,
            gender=registration_data.gender if registration_data.gender else None,
            communications_accepted=registration_data.communicationsAccepted,
            group_name=registration_data.groupName if registration_data.groupName else None,
        )
        db.commit()
        db.refresh(result.league_player)
    except ServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        db.rollback()
        logger.exception("Solo registration failed: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")

    try:
        if trigger_team_generation_if_ready(registration_data.league_id, db):
            db.commit()
    except Exception as e:
        logger.exception("Team generation trigger failed after solo registration: %s", e)

    # Send waiver prompt email (best-effort)
    try:
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(
            None,
            functools.partial(
                send_waiver_prompt,
                to_email=result.player.email,
                to_name=f"{result.player.first_name} {result.player.last_name}",
                league_name=result.league_name,
                league_id=str(registration_data.league_id),
                expiry_days=settings.WAIVER_EXPIRY_DAYS,
            ),
        )
    except Exception as e:
        logger.exception("Waiver prompt email failed after solo registration: %s", e)

    lp = result.league_player
    return RegistrationResponse(
        success=True,
        message=f"Successfully registered for {result.league_name}",
        registration=LeagueRegistrationResponse(
            id=lp.id,
            league_id=lp.league_id,
            league_name=result.league_name,
            player_id=lp.player_id,
            registration_status=lp.registration_status,
            payment_status=lp.payment_status,
            waiver_status=lp.waiver_status,
            team_id=lp.team_id,
            group_id=lp.group_id,
            group_name=result.group_name,
            created_at=lp.created_at.isoformat(),
            updated_at=lp.updated_at.isoformat(),
        ),
        player_id=result.player.id,
    )


# ---------------------------------------------------------------------------
# Group registration (invitation-based)
# ---------------------------------------------------------------------------

@router.post("/group", response_model=RegistrationResponse, summary="Register a group — organizer confirmed, invitees emailed")
@limiter.limit("5/minute")
async def register_group(
    request: Request,
    registration_data: GroupRegistrationRequest,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RegistrationResponse:
    clerk_user_id = _get_clerk_id(user)

    try:
        result = registration_svc.register_group(
            db,
            clerk_user_id,
            league_id=registration_data.league_id,
            group_name=registration_data.groupName,
            players=[p.model_dump() for p in registration_data.players],
            invitation_expiry_days=settings.INVITATION_EXPIRY_DAYS,
        )
        db.commit()
    except ServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        db.rollback()
        logger.exception("Group registration failed: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")

    # Send invitation emails concurrently (best-effort — don't roll back if email fails)
    if settings.RESEND_API_KEY and result.invitation_emails:
        loop = asyncio.get_running_loop()

        async def _send(ed):
            try:
                await loop.run_in_executor(
                    None,
                    functools.partial(
                        send_group_invitation,
                        to_email=ed.to_email,
                        to_name=ed.to_name,
                        inviter_name=result.organizer_name,
                        group_name=result.group_name,
                        league_name=result.league_name,
                        token=ed.token,
                        app_url=settings.APP_URL,
                        expiry_days=settings.INVITATION_EXPIRY_DAYS,
                    ),
                )
            except Exception as e:
                logger.error(
                    "Failed to send invitation email for group %s: %s",
                    result.group_id, e,
                )

        await asyncio.gather(*[_send(ed) for ed in result.invitation_emails])

    # Send waiver prompt email to organizer (best-effort)
    try:
        organizer = db.query(Player).filter(Player.id == result.organizer_player_id).first()
        if organizer:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(
                None,
                functools.partial(
                    send_waiver_prompt,
                    to_email=organizer.email,
                    to_name=result.organizer_name,
                    league_name=result.league_name,
                    league_id=str(registration_data.league_id),
                    expiry_days=settings.WAIVER_EXPIRY_DAYS,
                ),
            )
    except Exception as e:
        logger.exception("Waiver prompt email failed after group registration: %s", e)

    return RegistrationResponse(
        success=True,
        message=(
            f"Group '{result.group_name}' created for {result.league_name}. "
            f"You are confirmed. {result.invitations_created} invitation(s) sent."
        ),
        player_id=result.organizer_player_id,
    )


# ---------------------------------------------------------------------------
# Invitation endpoints
# ---------------------------------------------------------------------------

@router.get("/invite/{token}", response_model=InvitationDetailResponse, summary="Get invitation details (public)")
@limiter.limit("10/minute")
async def get_invitation(request: Request, token: str = Path(..., max_length=100), db: Session = Depends(get_db)) -> InvitationDetailResponse:
    try:
        detail = invitation_svc.get_invitation_details(db, token)
    except ServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    return InvitationDetailResponse(
        group_id=detail.group_id,
        group_name=detail.group_name,
        league_id=detail.league_id,
        league_name=detail.league_name,
        inviter_name=detail.inviter_name,
        invitee_first_name=detail.invitee_first_name,
        invitee_last_name=detail.invitee_last_name,
        status=detail.status,
        expires_at=detail.expires_at,
    )


@router.post("/invite/{token}/accept", response_model=SuccessResponse, summary="Accept a group invitation (authenticated)")
@limiter.limit("10/minute")
async def accept_invitation(
    request: Request,
    token: str = Path(..., max_length=100),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    clerk_user_id = _get_clerk_id(user)
    jwt_email = user.get("email", "")

    try:
        result = invitation_svc.accept_invitation(db, clerk_user_id, jwt_email, token)
        db.commit()
    except ServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        db.rollback()
        logger.exception("Accept invitation failed: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")

    try:
        if trigger_team_generation_if_ready(result.league_id, db):
            db.commit()
    except Exception as e:
        logger.exception("Team generation trigger failed after invitation acceptance: %s", e)

    # Send waiver prompt email to the invitee who just accepted (best-effort)
    try:
        player = db.query(Player).filter(Player.clerk_user_id == clerk_user_id).first()
        league = db.query(League).filter(League.id == result.league_id).first()
        if player and league:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(
                None,
                functools.partial(
                    send_waiver_prompt,
                    to_email=player.email,
                    to_name=f"{player.first_name} {player.last_name}",
                    league_name=league.name,
                    league_id=str(result.league_id),
                    expiry_days=settings.WAIVER_EXPIRY_DAYS,
                ),
            )
    except Exception as e:
        logger.exception("Waiver prompt email failed after invitation acceptance: %s", e)

    return SuccessResponse(success=True, message="Invitation accepted. You are now registered for the league.")


@router.post("/invite/{token}/decline", response_model=SuccessResponse, summary="Decline a group invitation")
@limiter.limit("5/minute")
async def decline_invitation(
    request: Request,
    token: str = Path(..., max_length=100),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    jwt_email = user.get("email", "")

    try:
        invitation_svc.decline_invitation(db, jwt_email, token)
        db.commit()
    except ServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        db.rollback()
        logger.exception("Failed to decline invitation: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")

    return SuccessResponse(success=True, message="Invitation declined.")


@router.get("/invitations/{invitation_id}/token", summary="Get the invitation token for navigation (authenticated)")
@limiter.limit("30/minute")
async def get_invitation_token(
    request: Request,
    invitation_id: UUID,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    clerk_user_id = _get_clerk_id(user)
    try:
        token = invitation_svc.get_invitation_token_for_user(db, clerk_user_id, invitation_id)
    except ServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    return {"token": token}


@router.get("/invitations/me", response_model=list[PendingInvitationResponse], summary="Get pending invitations for the current user")
@limiter.limit("30/minute")
async def get_my_invitations(
    request: Request,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[PendingInvitationResponse]:
    clerk_user_id = _get_clerk_id(user)
    items = invitation_svc.get_pending_invitations(db, clerk_user_id)
    return [
        PendingInvitationResponse(
            invitation_id=item.invitation_id,
            group_name=item.group_name,
            league_name=item.league_name,
            inviter_name=item.inviter_name,
            expires_at=item.expires_at,
        )
        for item in items
    ]


# ---------------------------------------------------------------------------
# Group viewing endpoints
# ---------------------------------------------------------------------------

@router.get("/groups/mine", response_model=list[MyGroupResponse], summary="Get groups the current user is part of")
@limiter.limit("30/minute")
async def get_my_groups(
    request: Request,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[MyGroupResponse]:
    clerk_user_id = _get_clerk_id(user)
    groups = invitation_svc.get_my_groups(db, clerk_user_id)
    return [
        MyGroupResponse(
            group_id=g.group_id,
            group_name=g.group_name,
            league_id=g.league_id,
            league_name=g.league_name,
            is_organizer=g.is_organizer,
            members=[
                GroupMemberDetail(
                    invitation_id=m.invitation_id,
                    player_id=m.player_id,
                    first_name=m.first_name,
                    last_name=m.last_name,
                    email=m.email,
                    status=m.status,
                    is_organizer=m.is_organizer,
                )
                for m in g.members
            ],
        )
        for g in groups
    ]


@router.delete("/groups/invitations/{invitation_id}", response_model=SuccessResponse, summary="Revoke a pending group invitation (organizer only)")
@limiter.limit("10/minute")
async def revoke_invitation(
    request: Request,
    invitation_id: UUID,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    clerk_user_id = _get_clerk_id(user)

    try:
        invitation_svc.revoke_invitation(db, clerk_user_id, invitation_id)
        db.commit()
    except ServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        db.rollback()
        logger.exception("Revoke invitation failed: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")

    return SuccessResponse(success=True, message="Invitation revoked.")


# ---------------------------------------------------------------------------
# Unregister from a league
# ---------------------------------------------------------------------------

@router.delete("/leagues/{league_id}", response_model=SuccessResponse, summary="Unregister the current player from a league")
@limiter.limit("10/minute")
async def unregister_from_league(
    request: Request,
    league_id: UUID,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    clerk_user_id = _get_clerk_id(user)

    try:
        registration_svc.unregister(db, clerk_user_id, league_id)
        db.commit()
    except ServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)
    except Exception as e:
        db.rollback()
        logger.exception("Unregister failed: %s", e)
        raise HTTPException(status_code=500, detail="An internal error occurred. Please try again.")

    return SuccessResponse(success=True, message="You have been unregistered from the league.")


# ---------------------------------------------------------------------------
# My team roster (auth-gated, name-only)
# ---------------------------------------------------------------------------

@router.get("/leagues/{league_id}/my-team", response_model=MyTeamResponse, summary="Get the caller's team roster for a league")
@limiter.limit("30/minute")
async def get_my_team(
    request: Request,
    league_id: UUID,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MyTeamResponse:
    clerk_user_id = _get_clerk_id(user)

    try:
        result = registration_svc.get_my_team_roster(db, clerk_user_id, league_id)
    except ServiceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    return MyTeamResponse(
        team_id=result.team_id,
        team_name=result.team_name,
        team_color=result.team_color,
        members=[
            TeamMemberPublic(
                first_name=m.first_name,
                last_name=m.last_name,
                is_you=m.is_you,
            )
            for m in result.members
        ],
    )


# ---------------------------------------------------------------------------
# Player registration history
# ---------------------------------------------------------------------------

@router.get("/player/{user_id}/leagues", response_model=list[LeagueRegistrationResponse], summary="Get all league registrations for a player")
@limiter.limit("30/minute")
async def get_player_registrations(
    request: Request,
    user_id: str = Path(..., max_length=200),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, le=200),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[LeagueRegistrationResponse]:
    if user.get("id") != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    items = registration_svc.get_player_registrations(db, user_id, skip, limit)
    return [
        LeagueRegistrationResponse(
            id=item.league_player.id,
            league_id=item.league_player.league_id,
            league_name=item.league_name,
            player_id=item.league_player.player_id,
            registration_status=item.league_player.registration_status,
            payment_status=item.league_player.payment_status,
            waiver_status=item.league_player.waiver_status,
            team_id=item.league_player.team_id,
            group_id=item.league_player.group_id,
            group_name=item.group_name,
            created_at=item.league_player.created_at.isoformat(),
            updated_at=item.league_player.updated_at.isoformat(),
        )
        for item in items
    ]
