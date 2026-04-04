import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.waiver import Waiver, WaiverSignature
from app.models.league_player import LeaguePlayer
from app.models.player import Player
from app.models.league import League
from app.core.constants import REG_CONFIRMED, REG_EXPIRED, WAIVER_EXPIRED, WAIVER_PENDING, WAIVER_SIGNED
from app.services.exceptions import ServiceError, ConflictError, NotFoundError

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Result dataclasses
# ---------------------------------------------------------------------------

@dataclass
class WaiverStatusResult:
    signed: bool
    signed_at: Optional[datetime]
    waiver_version: Optional[str]
    waiver_deadline: Optional[datetime]


@dataclass
class LeagueSignatureInfo:
    id: UUID
    player_name: str
    player_email: str
    waiver_version: str
    signed_at: datetime
    pdf_path: Optional[str]


@dataclass
class PlayerSignatureSummary:
    signature_id: UUID
    league_id: UUID
    league_name: str
    waiver_version: str
    full_name_typed: str
    signed_at: datetime
    has_pdf: bool


@dataclass
class SignatureDetail:
    signature_id: UUID
    league_id: UUID
    league_name: str
    waiver_version: str
    waiver_content: str
    full_name_typed: str
    signed_at: datetime
    has_pdf: bool


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
        user_agent=user_agent[:512] if user_agent else None,
    )
    db.add(signature)

    # Update league player waiver status
    league_player.waiver_status = WAIVER_SIGNED

    db.flush()
    logger.info("Waiver signed: signature_id=%s league_id=%s", signature.id, league_id)
    return signature


def get_waiver_status(db: Session, player_id: UUID, league_id: UUID) -> WaiverStatusResult:
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

    deadline = lp.waiver_deadline if lp else None
    if sig:
        return WaiverStatusResult(signed=True, signed_at=sig.signed_at, waiver_version=sig.version, waiver_deadline=deadline)
    return WaiverStatusResult(signed=False, signed_at=None, waiver_version=None, waiver_deadline=deadline)


def get_signatures_for_league(db: Session, league_id: UUID) -> list[LeagueSignatureInfo]:
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
        LeagueSignatureInfo(
            id=row.id,
            player_name=f"{row.first_name} {row.last_name}",
            player_email=row.email,
            waiver_version=row.version,
            signed_at=row.signed_at,
            pdf_path=row.pdf_path,
        )
        for row in rows
    ]


def get_player_signatures(db: Session, player_id: UUID) -> list[PlayerSignatureSummary]:
    """Return all signed waivers for a player, ordered by most recent first."""
    rows = (
        db.query(
            WaiverSignature.id,
            WaiverSignature.league_id,
            WaiverSignature.signed_at,
            WaiverSignature.full_name_typed,
            WaiverSignature.pdf_path,
            League.name.label("league_name"),
            Waiver.version,
        )
        .join(Waiver, WaiverSignature.waiver_id == Waiver.id)
        .join(League, WaiverSignature.league_id == League.id)
        .filter(WaiverSignature.player_id == player_id)
        .order_by(WaiverSignature.signed_at.desc())
        .all()
    )
    return [
        PlayerSignatureSummary(
            signature_id=row.id,
            league_id=row.league_id,
            league_name=row.league_name,
            waiver_version=row.version,
            full_name_typed=row.full_name_typed,
            signed_at=row.signed_at,
            has_pdf=row.pdf_path is not None,
        )
        for row in rows
    ]


def get_signature_detail(db: Session, signature_id: UUID, player_id: UUID) -> SignatureDetail | None:
    """Return full waiver detail for a specific signature, enforcing player ownership."""
    row = (
        db.query(
            WaiverSignature.id,
            WaiverSignature.league_id,
            WaiverSignature.signed_at,
            WaiverSignature.full_name_typed,
            WaiverSignature.pdf_path,
            League.name.label("league_name"),
            Waiver.version,
            Waiver.content.label("waiver_content"),
        )
        .join(Waiver, WaiverSignature.waiver_id == Waiver.id)
        .join(League, WaiverSignature.league_id == League.id)
        .filter(
            WaiverSignature.id == signature_id,
            WaiverSignature.player_id == player_id,
        )
        .first()
    )
    if not row:
        return None
    return SignatureDetail(
        signature_id=row.id,
        league_id=row.league_id,
        league_name=row.league_name,
        waiver_version=row.version,
        waiver_content=row.waiver_content,
        full_name_typed=row.full_name_typed,
        signed_at=row.signed_at,
        has_pdf=row.pdf_path is not None,
    )


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

    Uses bulk operations to avoid loading all rows into memory.
    Returns a dict of {league_id: expired_count} for affected leagues.
    """
    from sqlalchemy import func as sa_func

    now = datetime.now(timezone.utc)
    filter_conds = [
        LeaguePlayer.waiver_status == WAIVER_PENDING,
        LeaguePlayer.waiver_deadline != None,
        LeaguePlayer.waiver_deadline < now,
        LeaguePlayer.is_active == True,
    ]

    # Get per-league counts before the bulk update
    affected = dict(
        db.query(LeaguePlayer.league_id, sa_func.count(LeaguePlayer.id))
        .filter(*filter_conds)
        .group_by(LeaguePlayer.league_id)
        .all()
    )

    if affected:
        db.query(LeaguePlayer).filter(*filter_conds).update(
            {
                "registration_status": REG_EXPIRED,
                "waiver_status": WAIVER_EXPIRED,
                "is_active": False,
            },
            synchronize_session="fetch",
        )
        total = sum(affected.values())
        logger.info("Expired %d overdue waiver registrations across %d leagues", total, len(affected))

    return affected


def expire_unsigned_for_league(db: Session, league_id: UUID) -> int:
    """Expire all unsigned waivers for a specific league. Used by deadline handler."""
    count = (
        db.query(LeaguePlayer)
        .filter(
            LeaguePlayer.league_id == league_id,
            LeaguePlayer.waiver_status == WAIVER_PENDING,
            LeaguePlayer.is_active == True,
        )
        .update({
            "registration_status": REG_EXPIRED,
            "waiver_status": WAIVER_EXPIRED,
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
            LeaguePlayer.registration_status == REG_CONFIRMED,
            LeaguePlayer.waiver_status == WAIVER_PENDING,
            LeaguePlayer.is_active == True,
            # Only count as pending if deadline hasn't passed yet
            (LeaguePlayer.waiver_deadline == None) | (LeaguePlayer.waiver_deadline >= now),
        )
        .first()
    ) is not None
