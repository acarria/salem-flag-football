"""Registration domain logic extracted from app/api/registration.py.

All functions accept a db Session but do NOT commit — the caller (router) owns
the transaction boundary.
"""

import logging
import secrets
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.group import Group
from app.models.group_invitation import GroupInvitation
from app.models.league import League
from app.models.league_player import LeaguePlayer
from app.models.player import Player
from app.models.team import Team
from app.services.exceptions import ConflictError, NotFoundError, ServiceError
from app.services.league_service import get_occupied_spots, get_player_cap
from app.core.config import settings
from app.core.constants import (
    INVITE_PENDING,
    PAY_PENDING,
    PLAYERS_PER_TEAM,
    REG_CONFIRMED,
    WAIVER_PENDING,
)
from app.services.player_service import upsert_player

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Result dataclasses
# ---------------------------------------------------------------------------


@dataclass
class SoloRegistrationResult:
    league_player: LeaguePlayer
    player: Player
    league_name: str
    group_name: Optional[str]


@dataclass
class InvitationEmailData:
    to_email: str
    to_name: str
    token: str


@dataclass
class GroupRegistrationResult:
    organizer_player_id: UUID
    group_id: UUID
    group_name: str
    league_name: str
    organizer_name: str
    invitations_created: int
    invitation_emails: list = field(default_factory=list)  # list[InvitationEmailData]


@dataclass
class TeamRosterMember:
    first_name: str
    last_name: str
    is_you: bool


@dataclass
class TeamRosterResult:
    team_id: UUID
    team_name: str
    team_color: Optional[str]
    members: list  # list[TeamRosterMember]


@dataclass
class RegistrationHistoryItem:
    league_player: LeaguePlayer
    league_name: Optional[str]
    group_name: Optional[str]


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _validate_and_lock_league(
    db: Session,
    league_id: UUID,
    spots_needed: int = 1,
) -> League:
    """Lock the league row (FOR UPDATE), validate active/deadline/capacity.

    Raises ServiceError on any failure. Returns the locked League.
    """
    league = db.query(League).filter(League.id == league_id).with_for_update().first()
    if not league:
        raise NotFoundError("League not found")
    if not league.is_active:
        raise ServiceError("League is not currently active")
    if league.registration_deadline and league.registration_deadline < datetime.now(timezone.utc).date():
        raise ServiceError("Registration deadline has passed")
    player_cap = get_player_cap(league.format, league.max_teams)
    if player_cap is not None:
        occupied = get_occupied_spots(league.id, db)
        if occupied + spots_needed > player_cap:
            if spots_needed == 1:
                raise ServiceError("This league is full — no spots remaining")
            else:
                raise ServiceError(
                    f"Not enough spots remaining for this group. Available: {player_cap - occupied}"
                )
    return league


def _check_not_registered(db: Session, league_id: UUID, player_id: UUID) -> None:
    """Raise ServiceError if the player already has an active registration."""
    existing = db.query(LeaguePlayer).filter(
        LeaguePlayer.league_id == league_id,
        LeaguePlayer.player_id == player_id,
        LeaguePlayer.is_active == True,
    ).first()
    if existing:
        raise ServiceError("You are already registered for this league")


def _create_confirmed_league_player(
    db: Session,
    league_id: UUID,
    player_id: UUID,
    group_id: Optional[UUID],
    clerk_user_id: str,
) -> LeaguePlayer:
    """Create a confirmed LeaguePlayer with standard defaults. Does NOT commit."""
    lp = LeaguePlayer(
        league_id=league_id,
        player_id=player_id,
        group_id=group_id,
        registration_status=REG_CONFIRMED,
        payment_status=PAY_PENDING,
        waiver_status=WAIVER_PENDING,
        waiver_deadline=datetime.now(timezone.utc) + timedelta(days=settings.WAIVER_EXPIRY_DAYS),
        created_by=clerk_user_id,
    )
    db.add(lp)
    return lp


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def register_solo(
    db: Session,
    clerk_user_id: str,
    *,
    league_id: UUID,
    first_name: str,
    last_name: str,
    email: str,
    phone: str,
    date_of_birth: date,
    gender: Optional[str],
    communications_accepted: bool,
    group_name: Optional[str] = None,
) -> SoloRegistrationResult:
    """Solo registration: lock league, upsert player, optional group join, create LP.

    Does NOT commit.
    """
    league = _validate_and_lock_league(db, league_id, spots_needed=1)

    player = upsert_player(
        db,
        clerk_user_id,
        first_name=first_name,
        last_name=last_name,
        email=email,
        phone=phone,
        date_of_birth=date_of_birth,
        gender=gender,
        communications_accepted=communications_accepted,
    )

    _check_not_registered(db, league_id, player.id)

    gid = None
    if group_name:
        group = db.query(Group).filter(
            Group.league_id == league_id,
            Group.name == group_name,
            Group.is_active == True,
        ).first()
        if not group:
            group = Group(
                league_id=league_id,
                name=group_name,
                created_by=player.id,
                created_by_clerk=clerk_user_id,
            )
            db.add(group)
            db.flush()
        gid = group.id

    league_player = _create_confirmed_league_player(db, league_id, player.id, gid, clerk_user_id)

    return SoloRegistrationResult(
        league_player=league_player,
        player=player,
        league_name=league.name,
        group_name=group_name,
    )


def register_group(
    db: Session,
    clerk_user_id: str,
    *,
    league_id: UUID,
    group_name: str,
    players: list,  # list of dicts with email/firstName/lastName
    invitation_expiry_days: int,
) -> GroupRegistrationResult:
    """Group registration: lock league, create group + organizer LP + invitations.

    Does NOT commit. Returns result with email data for post-commit dispatch.
    """
    league = _validate_and_lock_league(db, league_id, spots_needed=1 + len(players))

    # Validate group size against format
    players_per_team = PLAYERS_PER_TEAM.get(league.format)
    if players_per_team is None:
        raise ServiceError("Unsupported league format")
    max_invitees = players_per_team - 1
    if len(players) > max_invitees:
        raise ServiceError(
            f"A {league.format} group can have at most {max_invitees} invitees (plus you as organizer)"
        )

    organizer = db.query(Player).filter(Player.clerk_user_id == clerk_user_id).first()
    if not organizer:
        raise ServiceError("You must complete your player profile before creating a group.")

    _check_not_registered(db, league_id, organizer.id)

    group = Group(
        league_id=league_id,
        name=group_name,
        created_by=organizer.id,
        created_by_clerk=clerk_user_id,
    )
    db.add(group)
    db.flush()

    _create_confirmed_league_player(db, league_id, organizer.id, group.id, clerk_user_id)

    expires_at = datetime.now(timezone.utc) + timedelta(days=invitation_expiry_days)
    invitation_emails: list[InvitationEmailData] = []

    for invitee in players:
        token = secrets.token_urlsafe(32)
        inv_email = invitee["email"].lower().strip()
        inv_first = invitee["firstName"]
        inv_last = invitee["lastName"]
        invitation = GroupInvitation(
            group_id=group.id,
            league_id=league_id,
            email=inv_email,
            first_name=inv_first,
            last_name=inv_last,
            token=token,
            status=INVITE_PENDING,
            invited_by=organizer.id,
            expires_at=expires_at,
        )
        db.add(invitation)
        invitation_emails.append(InvitationEmailData(
            to_email=inv_email,
            to_name=f"{inv_first} {inv_last}",
            token=token,
        ))

    return GroupRegistrationResult(
        organizer_player_id=organizer.id,
        group_id=group.id,
        group_name=group_name,
        league_name=league.name,
        organizer_name=f"{organizer.first_name} {organizer.last_name}",
        invitations_created=len(invitation_emails),
        invitation_emails=invitation_emails,
    )


def unregister(db: Session, clerk_user_id: str, league_id: UUID) -> None:
    """Soft-delete the player's league registration. Does NOT commit."""
    player = db.query(Player).filter(Player.clerk_user_id == clerk_user_id).first()
    if not player:
        raise NotFoundError("Registration not found")

    league_player = db.query(LeaguePlayer).filter(
        LeaguePlayer.league_id == league_id,
        LeaguePlayer.player_id == player.id,
        LeaguePlayer.is_active == True,
    ).first()
    if not league_player:
        raise NotFoundError("Registration not found")

    if league_player.team_id is not None:
        raise ConflictError(
            "Teams have already been assigned; contact the league admin to be removed."
        )

    league_player.is_active = False


def get_my_team_roster(
    db: Session, clerk_user_id: str, league_id: UUID
) -> TeamRosterResult:
    """Return the player's team roster for a league."""
    player = db.query(Player).filter(Player.clerk_user_id == clerk_user_id).first()
    if not player:
        raise NotFoundError("Not registered for this league")

    league_player = db.query(LeaguePlayer).filter(
        LeaguePlayer.league_id == league_id,
        LeaguePlayer.player_id == player.id,
        LeaguePlayer.is_active == True,
    ).first()
    if not league_player:
        raise NotFoundError("Not registered for this league")
    if not league_player.team_id:
        raise NotFoundError("No team assigned yet")

    team = db.query(Team).filter(Team.id == league_player.team_id).first()
    if not team:
        raise NotFoundError("Team not found")

    team_members_lp = db.query(LeaguePlayer).filter(
        LeaguePlayer.team_id == league_player.team_id,
        LeaguePlayer.is_active == True,
    ).all()

    player_ids = [lp.player_id for lp in team_members_lp]
    players_by_id = {p.id: p for p in db.query(Player).filter(Player.id.in_(player_ids)).all()}

    members = []
    for lp in team_members_lp:
        p = players_by_id.get(lp.player_id)
        if p:
            members.append(TeamRosterMember(
                first_name=p.first_name,
                last_name=p.last_name,
                is_you=(p.id == player.id),
            ))

    return TeamRosterResult(
        team_id=team.id,
        team_name=team.name,
        team_color=team.color,
        members=members,
    )


def get_player_registrations(
    db: Session, clerk_user_id: str, skip: int = 0, limit: int = 50
) -> list[RegistrationHistoryItem]:
    """Return registration history with bulk-loaded league/group names."""
    player = db.query(Player).filter(Player.clerk_user_id == clerk_user_id).first()
    if not player:
        return []

    limit = min(limit, 200)
    registrations = db.query(LeaguePlayer).filter(
        LeaguePlayer.player_id == player.id,
        LeaguePlayer.is_active == True,
    ).offset(skip).limit(limit).all()

    if not registrations:
        return []

    league_ids = list({reg.league_id for reg in registrations})
    group_ids = list({reg.group_id for reg in registrations if reg.group_id})

    leagues_by_id = {le.id: le for le in db.query(League).filter(League.id.in_(league_ids)).all()}
    groups_by_id = {g.id: g for g in db.query(Group).filter(Group.id.in_(group_ids)).all()} if group_ids else {}

    result = []
    for reg in registrations:
        league = leagues_by_id.get(reg.league_id)
        group_name = groups_by_id[reg.group_id].name if reg.group_id in groups_by_id else None
        result.append(RegistrationHistoryItem(
            league_player=reg,
            league_name=league.name if league else None,
            group_name=group_name,
        ))

    return result
