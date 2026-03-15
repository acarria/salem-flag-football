"""
Deadline Handler — invoked by EventBridge Scheduler when a league's registration deadline fires.

Event payload:
  {"league_id": "<uuid-string>"}

This Lambda:
  1. Expires any still-pending group invitations (freeing reserved spots)
  2. Calls trigger_team_generation_if_ready with whoever is confirmed at deadline time
"""
import logging
from uuid import UUID

logger = logging.getLogger(__name__)


def handler(event, context):
    league_id = UUID(event["league_id"])
    logger.info("Deadline handler fired for league %s", league_id)

    from app.db.db import SessionLocal
    from app.models.group_invitation import GroupInvitation
    from app.services.team_generation_service import trigger_team_generation_if_ready

    db = SessionLocal()
    try:
        # Step 1: expire pending invitations so reserved spots no longer block generation
        expired_count = (
            db.query(GroupInvitation)
            .filter(
                GroupInvitation.league_id == league_id,
                GroupInvitation.status == "pending",
            )
            .update({"status": "expired"})
        )
        if expired_count:
            db.commit()
            logger.info("Expired %d pending invitations for league %s", expired_count, league_id)

        # Step 2: generate teams with whoever confirmed before the deadline
        triggered = trigger_team_generation_if_ready(league_id, db)
        if triggered:
            logger.info("Teams generated for league %s at deadline", league_id)
        else:
            logger.info("No team generation needed for league %s at deadline", league_id)

        return {"statusCode": 200, "league_id": str(league_id), "teams_generated": triggered}
    except Exception as exc:
        logger.exception("Deadline handler failed for league %s: %s", league_id, exc)
        raise
    finally:
        db.close()
