import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.waiver import Waiver, WaiverSignature
from app.models.league_player import LeaguePlayer
from app.models.player import Player
from app.models.league import League
from app.services.exceptions import ServiceError, ConflictError, NotFoundError

logger = logging.getLogger(__name__)


def get_active_waiver(db: Session) -> Waiver | None:
    return db.query(Waiver).filter(Waiver.is_active == True).first()


def sign_waiver(
    db: Session,
    player_id: UUID,
    league_id: UUID,
    waiver_id: UUID,
    full_name_typed: str,
    ip_address: str | None,
    user_agent: str | None,
) -> WaiverSignature:
    # Validate waiver exists and is active
    waiver = db.query(Waiver).filter(Waiver.id == waiver_id).first()
    if not waiver:
        raise NotFoundError("Waiver not found")
    if not waiver.is_active:
        raise ServiceError("This waiver version is no longer active. Please refresh and try again.", status_code=422)

    # Validate league exists
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise NotFoundError("League not found")

    # Validate player is registered for this league
    league_player = (
        db.query(LeaguePlayer)
        .filter(
            LeaguePlayer.player_id == player_id,
            LeaguePlayer.league_id == league_id,
            LeaguePlayer.is_active == True,
        )
        .first()
    )
    if not league_player:
        raise NotFoundError("You are not registered for this league")

    # Check waiver deadline
    if league_player.waiver_deadline and league_player.waiver_deadline < datetime.now(timezone.utc):
        raise ServiceError("Your waiver signing period has expired.", status_code=400)

    # Check for existing signature
    existing = (
        db.query(WaiverSignature)
        .filter(
            WaiverSignature.player_id == player_id,
            WaiverSignature.league_id == league_id,
            WaiverSignature.waiver_id == waiver_id,
        )
        .first()
    )
    if existing:
        raise ConflictError("Waiver already signed for this league")

    # Create signature
    signature = WaiverSignature(
        waiver_id=waiver_id,
        player_id=player_id,
        league_id=league_id,
        full_name_typed=full_name_typed,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(signature)

    # Update league player waiver status
    league_player.waiver_status = "signed"

    db.flush()
    logger.info("Waiver signed: signature_id=%s league_id=%s", signature.id, league_id)
    return signature


def get_waiver_status(db: Session, player_id: UUID, league_id: UUID) -> dict:
    sig = (
        db.query(WaiverSignature)
        .join(Waiver, WaiverSignature.waiver_id == Waiver.id)
        .filter(
            WaiverSignature.player_id == player_id,
            WaiverSignature.league_id == league_id,
        )
        .with_entities(WaiverSignature.signed_at, Waiver.version)
        .first()
    )

    # Get waiver deadline from league_player
    lp = (
        db.query(LeaguePlayer.waiver_deadline)
        .filter(
            LeaguePlayer.player_id == player_id,
            LeaguePlayer.league_id == league_id,
            LeaguePlayer.is_active == True,
        )
        .first()
    )

    if sig:
        return {
            "signed": True,
            "signed_at": sig.signed_at,
            "waiver_version": sig.version,
            "waiver_deadline": lp.waiver_deadline if lp else None,
        }
    return {
        "signed": False,
        "signed_at": None,
        "waiver_version": None,
        "waiver_deadline": lp.waiver_deadline if lp else None,
    }


def get_signatures_for_league(db: Session, league_id: UUID) -> list[dict]:
    rows = (
        db.query(
            WaiverSignature.id,
            WaiverSignature.signed_at,
            WaiverSignature.pdf_path,
            Player.first_name,
            Player.last_name,
            Player.email,
            Waiver.version,
        )
        .join(Player, WaiverSignature.player_id == Player.id)
        .join(Waiver, WaiverSignature.waiver_id == Waiver.id)
        .filter(WaiverSignature.league_id == league_id)
        .order_by(WaiverSignature.signed_at.desc())
        .all()
    )
    return [
        {
            "id": row.id,
            "player_name": f"{row.first_name} {row.last_name}",
            "player_email": row.email,
            "waiver_version": row.version,
            "signed_at": row.signed_at,
            "pdf_path": row.pdf_path,
        }
        for row in rows
    ]


def create_waiver_version(db: Session, version: str, content: str) -> Waiver:
    # Deactivate all existing active waivers
    db.query(Waiver).filter(Waiver.is_active == True).update({"is_active": False})

    waiver = Waiver(version=version, content=content, is_active=True)
    db.add(waiver)
    db.flush()
    logger.info("Created new waiver version: %s (id=%s)", version, waiver.id)
    return waiver


def expire_overdue_waivers(db: Session) -> dict[UUID, int]:
    """Expire registrations where waiver deadline has passed and waiver is unsigned.

    Returns a dict of {league_id: expired_count} for affected leagues.
    """
    now = datetime.now(timezone.utc)
    overdue = (
        db.query(LeaguePlayer)
        .filter(
            LeaguePlayer.waiver_status == "pending",
            LeaguePlayer.waiver_deadline != None,
            LeaguePlayer.waiver_deadline < now,
            LeaguePlayer.is_active == True,
        )
        .all()
    )

    affected: dict[UUID, int] = {}
    for lp in overdue:
        lp.registration_status = "expired"
        lp.waiver_status = "expired"
        lp.is_active = False
        affected[lp.league_id] = affected.get(lp.league_id, 0) + 1

    if affected:
        total = sum(affected.values())
        logger.info("Expired %d overdue waiver registrations across %d leagues", total, len(affected))
        db.flush()

    return affected


def expire_unsigned_for_league(db: Session, league_id: UUID) -> int:
    """Expire all unsigned waivers for a specific league. Used by deadline handler."""
    count = (
        db.query(LeaguePlayer)
        .filter(
            LeaguePlayer.league_id == league_id,
            LeaguePlayer.waiver_status == "pending",
            LeaguePlayer.is_active == True,
        )
        .update({
            "registration_status": "expired",
            "waiver_status": "expired",
            "is_active": False,
        })
    )
    if count:
        logger.info("Expired %d unsigned waivers for league %s", count, league_id)
    return count


def has_pending_waivers(db: Session, league_id: UUID) -> bool:
    """Check if any confirmed players still have pending waivers within their deadline."""
    now = datetime.now(timezone.utc)
    return (
        db.query(LeaguePlayer)
        .filter(
            LeaguePlayer.league_id == league_id,
            LeaguePlayer.registration_status == "confirmed",
            LeaguePlayer.waiver_status == "pending",
            LeaguePlayer.is_active == True,
            # Only count as pending if deadline hasn't passed yet
            (LeaguePlayer.waiver_deadline == None) | (LeaguePlayer.waiver_deadline >= now),
        )
        .first()
    ) is not None
