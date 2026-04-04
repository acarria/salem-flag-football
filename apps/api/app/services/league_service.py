from datetime import datetime, timezone
from typing import Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.league_player import LeaguePlayer
from app.models.group_invitation import GroupInvitation
from app.core.constants import INVITE_PENDING, PLAYERS_PER_TEAM, REG_CONFIRMED


def get_player_cap(league_format: str, max_teams: Optional[int]) -> Optional[int]:
    """Return the total player cap, or None if uncapped. Raises ValueError for unknown formats."""
    if max_teams is None:
        return None
    size = PLAYERS_PER_TEAM.get(league_format)
    if size is None:
        raise ValueError(f"Unknown league format: {league_format!r}")
    return max_teams * size


def get_occupied_spots(league_id: UUID, db: Session) -> int:
    """Return confirmed players + non-expired pending invitations for a league."""
    now = datetime.now(timezone.utc)

    confirmed = db.query(LeaguePlayer).filter(
        LeaguePlayer.league_id == league_id,
        LeaguePlayer.registration_status == REG_CONFIRMED,
        LeaguePlayer.is_active == True,
    ).count()
    pending_invites = db.query(GroupInvitation).filter(
        GroupInvitation.league_id == league_id,
        GroupInvitation.status == INVITE_PENDING,
        GroupInvitation.expires_at > now,
    ).count()
    return confirmed + pending_invites
