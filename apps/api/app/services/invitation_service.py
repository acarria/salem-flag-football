"""Invitation lifecycle logic extracted from app/api/registration.py.

All functions accept a db Session but do NOT commit — the caller (router) owns
the transaction boundary.
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session, joinedload

from app.models.group import Group
from app.models.group_invitation import GroupInvitation
from app.models.league import League
from app.models.league_player import LeaguePlayer
from app.models.player import Player
from app.core.config import settings
from app.core.constants import (
    INVITE_ACCEPTED,
    INVITE_DECLINED,
    INVITE_EXPIRED,
    INVITE_PENDING,
    INVITE_REVOKED,
    PAY_PENDING,
    REG_CONFIRMED,
    WAIVER_PENDING,
)
from app.services.exceptions import ForbiddenError, NotFoundError, ServiceError
from app.services.league_service import get_occupied_spots, get_player_cap

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Result dataclasses
# ---------------------------------------------------------------------------


@dataclass
class InvitationDetail:
    group_id: UUID
    group_name: str
    league_id: UUID
    league_name: str
    inviter_name: str
    invitee_first_name: str
    invitee_last_name: str
    status: str
    expires_at: str


@dataclass
class AcceptResult:
    league_id: UUID


@dataclass
class PendingInvitationInfo:
    invitation_id: UUID
    group_name: str
    league_name: str
    inviter_name: str
    expires_at: str


@dataclass
class GroupMemberInfo:
    invitation_id: Optional[UUID]
    player_id: Optional[UUID]
    first_name: str
    last_name: str
    email: Optional[str]
    status: str
    is_organizer: bool


@dataclass
class MyGroupInfo:
    group_id: UUID
    group_name: str
    league_id: UUID
    league_name: str
    is_organizer: bool
    members: list  # list[GroupMemberInfo]


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _invalidate_token(inv: GroupInvitation) -> None:
    """Null the token — used by accept, decline, and revoke."""
    inv.token = None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def get_invitation_details(db: Session, token: str) -> InvitationDetail:
    """Public lookup. Computes effective expired status without writing."""
    inv = db.query(GroupInvitation).options(
        joinedload(GroupInvitation.group),
        joinedload(GroupInvitation.league),
        joinedload(GroupInvitation.inviter),
    ).filter(GroupInvitation.token == token).first()
    if not inv:
        raise NotFoundError("Invitation not found")

    effective_status = inv.status
    if inv.status == INVITE_PENDING and inv.expires_at < datetime.now(timezone.utc):
        effective_status = INVITE_EXPIRED

    return InvitationDetail(
        group_id=inv.group_id,
        group_name=inv.group.name if inv.group else "",
        league_id=inv.league_id,
        league_name=inv.league.name if inv.league else "",
        inviter_name=f"{inv.inviter.first_name} {inv.inviter.last_name}" if inv.inviter else "",
        invitee_first_name=inv.first_name,
        invitee_last_name=inv.last_name,
        status=effective_status,
        expires_at=inv.expires_at.isoformat(),
    )


def accept_invitation(
    db: Session,
    clerk_user_id: str,
    user_email: str,
    token: str,
) -> AcceptResult:
    """Lock invitation + league, validate email ownership, create LP.

    Does NOT commit.
    """
    inv = db.query(GroupInvitation).filter(
        GroupInvitation.token == token
    ).with_for_update().first()
    if not inv:
        raise NotFoundError("Invitation not found")
    if inv.status != INVITE_PENDING:
        raise ServiceError("This invitation is no longer available")
    if inv.expires_at < datetime.now(timezone.utc):
        inv.status = INVITE_EXPIRED
        raise ServiceError("Invitation has expired")

    player = db.query(Player).filter(Player.clerk_user_id == clerk_user_id).first()
    if not player:
        raise ServiceError("Please complete your player profile before accepting an invitation.")

    jwt_email = user_email.lower()
    if not jwt_email or jwt_email != inv.email.lower():
        raise ForbiddenError("This invitation was not sent to your email address.")

    existing = db.query(LeaguePlayer).filter(
        LeaguePlayer.league_id == inv.league_id,
        LeaguePlayer.player_id == player.id,
        LeaguePlayer.is_active == True,
    ).first()
    if existing:
        raise ServiceError("You are already registered for this league")

    # Lock the league row and re-check capacity
    league = db.query(League).filter(League.id == inv.league_id).with_for_update().first()
    if not league or not league.is_active:
        raise NotFoundError("League not found or inactive")
    player_cap = get_player_cap(league.format, league.max_teams)
    if player_cap is not None:
        occupied = get_occupied_spots(league.id, db)
        if occupied >= player_cap:
            raise ServiceError("This league is full")

    from app.services.registration_service import _create_confirmed_league_player
    league_player = _create_confirmed_league_player(db, inv.league_id, player.id, inv.group_id, clerk_user_id)

    inv.status = INVITE_ACCEPTED
    inv.player_id = player.id
    _invalidate_token(inv)

    return AcceptResult(league_id=inv.league_id)


def decline_invitation(db: Session, user_email: str, token: str) -> None:
    """Mark invitation as declined. Does NOT commit."""
    inv = db.query(GroupInvitation).filter(GroupInvitation.token == token).first()
    if not inv:
        raise NotFoundError("Invitation not found")
    if inv.status != INVITE_PENDING:
        raise ServiceError("Invitation is no longer active")

    jwt_email = user_email.lower()
    if not jwt_email or jwt_email != inv.email.lower():
        raise ForbiddenError("This invitation was not sent to your email address.")

    inv.status = INVITE_DECLINED
    _invalidate_token(inv)


def revoke_invitation(db: Session, clerk_user_id: str, invitation_id: UUID) -> None:
    """Organizer-only revocation. Does NOT commit."""
    player = db.query(Player).filter(Player.clerk_user_id == clerk_user_id).first()
    if not player:
        raise NotFoundError("Player not found")

    inv = db.query(GroupInvitation).filter(GroupInvitation.id == invitation_id).first()
    if not inv:
        raise NotFoundError("Invitation not found")
    if inv.status != INVITE_PENDING:
        raise ServiceError("This invitation is no longer available")

    if inv.invited_by != player.id:
        raise ForbiddenError("Only the group organizer can revoke invitations")

    inv.status = INVITE_REVOKED
    _invalidate_token(inv)


def get_invitation_token_for_user(db: Session, clerk_user_id: str, invitation_id: UUID) -> str:
    """Return the token for an invitation owned by the requesting user's email."""
    player = db.query(Player).filter(Player.clerk_user_id == clerk_user_id).first()
    if not player:
        raise NotFoundError("Invitation not found")
    inv = db.query(GroupInvitation).filter(
        GroupInvitation.id == invitation_id,
        GroupInvitation.email == player.email.lower(),
        GroupInvitation.status == INVITE_PENDING,
    ).first()
    if not inv or not inv.token:
        raise NotFoundError("Invitation not found")
    return inv.token


def get_pending_invitations(db: Session, clerk_user_id: str) -> list[PendingInvitationInfo]:
    """Return pending invitations for the player's email. Bulk-loads related data."""
    player = db.query(Player).filter(Player.clerk_user_id == clerk_user_id).first()
    if not player:
        return []

    now = datetime.now(timezone.utc)
    invitations = db.query(GroupInvitation).filter(
        GroupInvitation.email == player.email.lower(),
        GroupInvitation.status == INVITE_PENDING,
        GroupInvitation.expires_at > now,
    ).all()

    if not invitations:
        return []

    grp_ids = [inv.group_id for inv in invitations]
    lea_ids = [inv.league_id for inv in invitations]
    inviter_ids = [inv.invited_by for inv in invitations if inv.invited_by]

    groups_by_id = {g.id: g for g in db.query(Group).filter(Group.id.in_(grp_ids)).all()}
    leagues_by_id = {le.id: le for le in db.query(League).filter(League.id.in_(lea_ids)).all()}
    inviters_by_id = (
        {p.id: p for p in db.query(Player).filter(Player.id.in_(inviter_ids)).all()}
        if inviter_ids
        else {}
    )

    result = []
    for inv in invitations:
        group = groups_by_id.get(inv.group_id)
        league = leagues_by_id.get(inv.league_id)
        inviter = inviters_by_id.get(inv.invited_by)
        result.append(PendingInvitationInfo(
            invitation_id=inv.id,
            group_name=group.name if group else "",
            league_name=league.name if league else "",
            inviter_name=f"{inviter.first_name} {inviter.last_name}" if inviter else "",
            expires_at=inv.expires_at.isoformat(),
        ))

    return result


def get_my_groups(db: Session, clerk_user_id: str) -> list[MyGroupInfo]:
    """Return groups with PII visibility rules. Bulk-loads all related data (7 queries)."""
    player = db.query(Player).filter(Player.clerk_user_id == clerk_user_id).first()
    if not player:
        return []

    league_players = db.query(LeaguePlayer).filter(
        LeaguePlayer.player_id == player.id,
        LeaguePlayer.group_id != None,  # noqa: E711
        LeaguePlayer.is_active == True,
    ).all()

    if not league_players:
        return []

    group_ids = list({lp.group_id for lp in league_players if lp.group_id})
    league_ids = list({lp.league_id for lp in league_players})

    groups_by_id = {g.id: g for g in db.query(Group).filter(Group.id.in_(group_ids)).all()}
    leagues_by_id = {le.id: le for le in db.query(League).filter(League.id.in_(league_ids)).all()}
    group_lps = db.query(LeaguePlayer).filter(
        LeaguePlayer.group_id.in_(group_ids),
        LeaguePlayer.is_active == True,
    ).all()
    member_ids = list({glp.player_id for glp in group_lps})
    players_by_id = {p.id: p for p in db.query(Player).filter(Player.id.in_(member_ids)).all()}
    pending_invites = db.query(GroupInvitation).filter(
        GroupInvitation.group_id.in_(group_ids),
        GroupInvitation.status == INVITE_PENDING,
    ).all()

    group_lps_by_group: dict = {}
    for glp in group_lps:
        group_lps_by_group.setdefault(glp.group_id, []).append(glp)
    pending_by_group: dict = {}
    for inv in pending_invites:
        pending_by_group.setdefault(inv.group_id, []).append(inv)

    lp_by_group = {}
    for lp in league_players:
        if lp.group_id and lp.group_id not in lp_by_group:
            lp_by_group[lp.group_id] = lp

    result = []
    for group_id in group_ids:
        group = groups_by_id.get(group_id)
        if not group:
            continue
        lp = lp_by_group.get(group_id)
        if not lp:
            continue
        league = leagues_by_id.get(lp.league_id)

        is_organizer = (group.created_by == player.id)

        members: list[GroupMemberInfo] = []
        for glp in group_lps_by_group.get(group_id, []):
            p = players_by_id.get(glp.player_id)
            if p:
                members.append(GroupMemberInfo(
                    invitation_id=None,
                    player_id=p.id,
                    first_name=p.first_name,
                    last_name=p.last_name,
                    email=p.email if (is_organizer or p.id == player.id) else None,
                    status=glp.registration_status,
                    is_organizer=(group.created_by == p.id),
                ))

        for inv in pending_by_group.get(group_id, []):
            members.append(GroupMemberInfo(
                invitation_id=inv.id,
                player_id=inv.player_id,
                first_name=inv.first_name,
                last_name=inv.last_name,
                email=inv.email if is_organizer else None,
                status="pending_invite",
                is_organizer=False,
            ))

        result.append(MyGroupInfo(
            group_id=group_id,
            group_name=group.name,
            league_id=lp.league_id,
            league_name=league.name if league else "",
            is_organizer=is_organizer,
            members=members,
        ))

    return result
