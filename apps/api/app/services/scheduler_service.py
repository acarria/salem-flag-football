"""
Scheduler Service

Uses AWS EventBridge Scheduler for deadline-triggered team generation.
Requires env vars:
  SCHEDULER_ROLE_ARN  — IAM role that EventBridge Scheduler assumes to invoke the target
  DEADLINE_LAMBDA_ARN — ARN of the deadline handler Lambda function

If either var is absent (e.g. local Docker dev), scheduling is skipped and a warning is logged.
The deadline can still be triggered manually via POST /admin/leagues/{id}/trigger-team-generation.
"""
import json
import logging
import os
from datetime import datetime, timezone
from uuid import UUID

logger = logging.getLogger(__name__)

_SCHEDULER_ROLE_ARN = os.getenv("SCHEDULER_ROLE_ARN")
_DEADLINE_LAMBDA_ARN = os.getenv("DEADLINE_LAMBDA_ARN")


def schedule_deadline_job(league_id: UUID, deadline_date) -> None:
    """
    Create (or replace) an EventBridge Scheduler one-time rule that invokes
    the deadline Lambda at 23:59 UTC on deadline_date.

    No-op if SCHEDULER_ROLE_ARN or DEADLINE_LAMBDA_ARN are not configured.
    """
    if deadline_date is None:
        return

    if not _SCHEDULER_ROLE_ARN or not _DEADLINE_LAMBDA_ARN:
        logger.warning(
            "schedule_deadline_job: SCHEDULER_ROLE_ARN or DEADLINE_LAMBDA_ARN not set — "
            "deadline auto-trigger is disabled. Trigger manually via "
            "POST /admin/leagues/%s/trigger-team-generation.",
            league_id,
        )
        return

    run_at = datetime.combine(deadline_date, datetime.min.time()).replace(
        hour=23, minute=59, second=0, tzinfo=timezone.utc
    )
    if run_at <= datetime.now(timezone.utc):
        logger.info("schedule_deadline_job: deadline already passed for league %s — skipping", league_id)
        return

    try:
        import boto3
        client = boto3.client("scheduler")
        schedule_name = f"deadline-{league_id}"

        client.create_schedule(
            Name=schedule_name,
            ScheduleExpression=f"at({run_at.strftime('%Y-%m-%dT%H:%M:%S')})",
            FlexibleTimeWindow={"Mode": "OFF"},
            Target={
                "Arn": _DEADLINE_LAMBDA_ARN,
                "RoleArn": _SCHEDULER_ROLE_ARN,
                "Input": json.dumps({"source": "aws.scheduler", "league_id": str(league_id)}),
            },
            # Replace existing schedule if deadline was updated
            ActionAfterCompletion="DELETE",
        )
        logger.info("Scheduled EventBridge deadline job %s for %s", schedule_name, run_at.isoformat())
    except Exception as exc:
        # Try update if schedule already exists (EventBridge returns ConflictException)
        from botocore.exceptions import ClientError
        if isinstance(exc, ClientError) and exc.response["Error"]["Code"] in (
            "ConflictException", "ResourceConflictException"
        ):
            try:
                client.update_schedule(
                    Name=f"deadline-{league_id}",
                    ScheduleExpression=f"at({run_at.strftime('%Y-%m-%dT%H:%M:%S')})",
                    FlexibleTimeWindow={"Mode": "OFF"},
                    Target={
                        "Arn": _DEADLINE_LAMBDA_ARN,
                        "RoleArn": _SCHEDULER_ROLE_ARN,
                        "Input": json.dumps({"source": "aws.scheduler", "league_id": str(league_id)}),
                    },
                    ActionAfterCompletion="DELETE",
                )
                logger.info("Updated EventBridge deadline job for league %s", league_id)
            except Exception as update_exc:
                logger.exception("Failed to update EventBridge schedule for league %s: %s", league_id, update_exc)
        else:
            logger.exception("Failed to create EventBridge schedule for league %s: %s", league_id, exc)
