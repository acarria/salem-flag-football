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
    payment_status: Optional[str] = None,
    waiver_status: Optional[str] = None,
) -> Player:
    """Create or update a Player record. Flushes on create but does NOT commit.

    Args:
        payment_status / waiver_status: On *create*, defaults to "pending" if
        None. On *update*, only overwrites if a non-None value is supplied.
    """
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
        if payment_status is not None:
            player.payment_status = payment_status
        if waiver_status is not None:
            player.waiver_status = waiver_status
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
            payment_status=payment_status or "pending",
            waiver_status=waiver_status or "pending",
            created_by=clerk_user_id,
        )
        db.add(player)
        db.flush()

    return player
