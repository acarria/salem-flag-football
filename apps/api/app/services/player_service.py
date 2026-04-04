"""Player create/update logic shared by registration and user-profile endpoints."""

import logging
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from app.models.player import Player

logger = logging.getLogger(__name__)


def upsert_player(
    db: Session,
    clerk_user_id: str,
    *,
    first_name: str,
    last_name: str,
    email: str,
    phone: str = "",
    date_of_birth: Optional[date] = None,
    gender: Optional[str] = None,
    communications_accepted: bool = False,
) -> Player:
    """Create or update a Player record. Flushes on create but does NOT commit."""
    normalized_email = email.lower().strip()
    normalized_gender = gender if gender else None

    player = db.query(Player).filter(Player.clerk_user_id == clerk_user_id).first()
    if player:
        player.first_name = first_name
        player.last_name = last_name
        player.email = normalized_email
        player.phone = phone
        player.date_of_birth = date_of_birth
        player.gender = normalized_gender
        player.communications_accepted = communications_accepted
        player.updated_at = datetime.now(timezone.utc)
    else:
        player = Player(
            clerk_user_id=clerk_user_id,
            first_name=first_name,
            last_name=last_name,
            email=normalized_email,
            phone=phone,
            date_of_birth=date_of_birth,
            gender=normalized_gender,
            communications_accepted=communications_accepted,
            created_by=clerk_user_id,
        )
        db.add(player)
        db.flush()

    return player
