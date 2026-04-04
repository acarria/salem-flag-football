"""
Deadline Handler — invoked by EventBridge Scheduler when a league's registration deadline fires.

Event payload:
  {"league_id": "<uuid-string>"}

This Lambda:
  1. Expires any still-pending group invitations (freeing reserved spots)
  2. Calls trigger_team_generation_if_ready with whoever is confirmed at deadline time

SECURITY: Invocation source is restricted at the IAM resource policy level — only the
EventBridge Scheduler execution role is permitted to invoke this function (enforced in the
SAM template via the ScheduleEvent event source). Do not grant other principals invoke
permission on this function.
"""
import logging
from datetime import datetime, timezone
from uuid import UUID

from app.core.constants import INVITE_EXPIRED, INVITE_PENDING

logger = logging.getLogger(__name__)

# Expected source identifier injected by the EventBridge Scheduler payload.
# This provides a defence-in-depth check in addition to IAM resource policy enforcement.
_EXPECTED_SOURCE = "aws.scheduler"


def handler(event, context):
    # Validate that the event originates from EventBridge Scheduler.
    # The SAM ScheduleEvent source automatically injects "source": "aws.scheduler".
    # Any direct Lambda invocation without this field is rejected.
    source = event.get("source")
    if source != _EXPECTED_SOURCE:
        logger.error(
            "Deadline handler rejected event with unexpected source %r (expected %r)",
            source,
            _EXPECTED_SOURCE,
        )
        return {"statusCode": 403, "error": "Forbidden: unexpected invocation source"}

    try:
        league_id = UUID(event["league_id"])
    except (KeyError, ValueError) as e:
        logger.error("Deadline handler received malformed event %s: %s", event, e)
        return {"statusCode": 400, "error": "Invalid event payload"}

    logger.info("Deadline handler fired for league %s", league_id)

    from app.db.db import SessionLocal
    from app.models.group_invitation import GroupInvitation
    from app.models.league import League
    from app.models.team import Team
    from app.services.team_generation_service import generate_teams
    from app.services.waiver_service import expire_unsigned_for_league, has_pending_waivers

    db = SessionLocal()
    try:
        # Idempotency guard: lock the league row and check if already processed
        league = db.query(League).filter(League.id == league_id).with_for_update().first()
        if not league:
            logger.error("League %s not found", league_id)
            return {"statusCode": 404, "error": "League not found"}
        if league.deadline_processed_at is not None:
            logger.info(
                "Deadline already processed for league %s at %s — skipping",
                league_id, league.deadline_processed_at,
            )
            return {"statusCode": 200, "league_id": str(league_id), "already_processed": True}
        league.deadline_processed_at = datetime.now(timezone.utc)
        db.flush()

        # Step 1: expire pending invitations so reserved spots no longer block generation
        expired_count = (
            db.query(GroupInvitation)
            .filter(
                GroupInvitation.league_id == league_id,
                GroupInvitation.status == INVITE_PENDING,
            )
            .update({"status": INVITE_EXPIRED, "updated_at": datetime.now(timezone.utc)})
        )
        if expired_count:
            logger.info("Expired %d pending invitations for league %s", expired_count, league_id)

        # Step 2: expire unsigned waivers so those spots are freed
        expired_waivers = expire_unsigned_for_league(db, league_id)
        if expired_waivers:
            logger.info("Expired %d unsigned waivers for league %s", expired_waivers, league_id)

        # Step 3: generate teams (inline readiness check to avoid separate commit)
        triggered = False
        existing_teams = db.query(Team).filter(
            Team.league_id == league_id, Team.is_active == True
        ).count()
        if existing_teams == 0 and not has_pending_waivers(db, league_id):
            generate_teams(league, db)
            triggered = True
            logger.info("Teams generated for league %s at deadline", league_id)
        else:
            logger.info("No team generation needed for league %s at deadline", league_id)

        # Single atomic commit for all work
        db.commit()

        return {"statusCode": 200, "league_id": str(league_id), "teams_generated": triggered}
    except Exception as exc:
        logger.exception("Deadline handler failed for league %s: %s", league_id, exc)
        raise
    finally:
        db.close()
