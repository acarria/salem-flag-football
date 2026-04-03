"""
Waiver Sweep Handler — invoked daily by EventBridge to expire overdue unsigned waivers.

Triggered by a recurring EventBridge rule (rate(1 day)).
For each league with expired waivers, attempts to trigger team generation.
"""
import logging

logger = logging.getLogger(__name__)

_EXPECTED_SOURCES = {"aws.events", "aws.scheduler"}


def handler(event, context):
    source = event.get("source", "")
    if source not in _EXPECTED_SOURCES:
        logger.error(
            "Waiver sweep handler rejected event with unexpected source %r",
            source,
        )
        return {"statusCode": 403, "error": "Forbidden: unexpected invocation source"}

    logger.info("Waiver sweep handler started")

    from app.db.db import SessionLocal
    from app.services.waiver_service import expire_overdue_waivers
    from app.services.team_generation_service import trigger_team_generation_if_ready

    db = SessionLocal()
    try:
        affected = expire_overdue_waivers(db)
        if affected:
            db.commit()
            logger.info("Expired waivers in %d leagues: %s", len(affected), affected)

            for league_id in affected:
                try:
                    triggered = trigger_team_generation_if_ready(league_id, db)
                    if triggered:
                        logger.info("Team generation triggered for league %s after waiver sweep", league_id)
                except Exception as e:
                    logger.exception("Team generation failed for league %s: %s", league_id, e)
        else:
            logger.info("No overdue waivers found")

        return {"statusCode": 200, "leagues_affected": len(affected)}
    except Exception as exc:
        logger.exception("Waiver sweep handler failed: %s", exc)
        raise
    finally:
        db.close()
