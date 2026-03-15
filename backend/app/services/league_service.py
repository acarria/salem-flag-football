from datetime import datetime, timezone
from typing import Optional
from uuid import UUID
from sqlalchemy.orm import Session


def get_player_cap(format: str, max_teams: Optional[int]) -> Optional[int]:
    """Return the total player cap given a format and max_teams, or None if uncapped."""
    if max_teams is None:
        return None
    return max_teams * (7 if format == '7v7' else 5)


def get_occupied_spots(league_id: UUID, db: Session) -> int:
    """Return confirmed players + non-expired pending invitations for a league."""
    from app.models.league_player import LeaguePlayer
    from app.models.group_invitation import GroupInvitation
    now = datetime.now(timezone.utc)

    confirmed = db.query(LeaguePlayer).filter(
        LeaguePlayer.league_id == league_id,
        LeaguePlayer.registration_status == "confirmed",
        LeaguePlayer.is_active == True,
    ).count()
    pending_invites = db.query(GroupInvitation).filter(
        GroupInvitation.league_id == league_id,
        GroupInvitation.status == "pending",
        GroupInvitation.expires_at > now,
    ).count()
    return confirmed + pending_invites
