import json
import logging
from datetime import date
from unittest.mock import patch, MagicMock
from uuid import uuid4


class TestScheduleDeadlineJobEarlyReturns:
    """Tests for cases where schedule_deadline_job returns early."""

    @patch("app.services.scheduler_service._SCHEDULER_ROLE_ARN", "arn:aws:iam::role")
    @patch("app.services.scheduler_service._DEADLINE_LAMBDA_ARN", "arn:aws:lambda:fn")
    def test_none_deadline_returns_early(self):
        """No boto3 call when deadline_date is None."""
        from app.services.scheduler_service import schedule_deadline_job

        with patch("boto3.client") as mock_boto:
            schedule_deadline_job(uuid4(), None)
            mock_boto.assert_not_called()

    @patch("app.services.scheduler_service._SCHEDULER_ROLE_ARN", "")
    @patch("app.services.scheduler_service._DEADLINE_LAMBDA_ARN", "arn:aws:lambda:fn")
    def test_missing_role_arn_logs_warning_and_returns(self, caplog):
        """Logs warning and skips when SCHEDULER_ROLE_ARN is empty."""
        from app.services.scheduler_service import schedule_deadline_job

        league_id = uuid4()
        with caplog.at_level(logging.WARNING, logger="app.services.scheduler_service"):
            with patch("boto3.client") as mock_boto:
                schedule_deadline_job(league_id, date(2099, 12, 31))
                mock_boto.assert_not_called()

        assert "SCHEDULER_ROLE_ARN or DEADLINE_LAMBDA_ARN not set" in caplog.text

    @patch("app.services.scheduler_service._SCHEDULER_ROLE_ARN", "arn:aws:iam::role")
    @patch("app.services.scheduler_service._DEADLINE_LAMBDA_ARN", "")
    def test_missing_lambda_arn_logs_warning_and_returns(self, caplog):
        """Logs warning and skips when DEADLINE_LAMBDA_ARN is empty."""
        from app.services.scheduler_service import schedule_deadline_job

        league_id = uuid4()
        with caplog.at_level(logging.WARNING, logger="app.services.scheduler_service"):
            with patch("boto3.client") as mock_boto:
                schedule_deadline_job(league_id, date(2099, 12, 31))
                mock_boto.assert_not_called()

        assert "SCHEDULER_ROLE_ARN or DEADLINE_LAMBDA_ARN not set" in caplog.text

    @patch("app.services.scheduler_service._SCHEDULER_ROLE_ARN", "arn:aws:iam::role")
    @patch("app.services.scheduler_service._DEADLINE_LAMBDA_ARN", "arn:aws:lambda:fn")
    def test_past_deadline_returns_early(self, caplog):
        """No schedule created when deadline is in the past."""
        from app.services.scheduler_service import schedule_deadline_job

        league_id = uuid4()
        past_date = date(2020, 1, 1)

        with caplog.at_level(logging.INFO, logger="app.services.scheduler_service"):
            with patch("boto3.client") as mock_boto:
                schedule_deadline_job(league_id, past_date)
                mock_boto.assert_not_called()

        assert "deadline already passed" in caplog.text


class TestScheduleDeadlineJobHappyPath:
    """Tests for successful schedule creation."""

    @patch("app.services.scheduler_service._SCHEDULER_ROLE_ARN", "arn:aws:iam::123:role/scheduler")
    @patch("app.services.scheduler_service._DEADLINE_LAMBDA_ARN", "arn:aws:lambda:us-east-1:123:function:deadline")
    def test_creates_schedule_with_correct_params(self):
        """Happy path: creates EventBridge schedule with correct parameters."""
        from app.services.scheduler_service import schedule_deadline_job

        league_id = uuid4()
        future_date = date(2099, 7, 15)
        mock_client = MagicMock()

        with patch("boto3.client", return_value=mock_client):
            schedule_deadline_job(league_id, future_date)

        mock_client.create_schedule.assert_called_once()
        kwargs = mock_client.create_schedule.call_args[1]

        assert kwargs["Name"] == f"deadline-{league_id}"
        assert kwargs["ScheduleExpression"] == "at(2099-07-15T23:59:00)"
        assert kwargs["FlexibleTimeWindow"] == {"Mode": "OFF"}
        assert kwargs["ActionAfterCompletion"] == "DELETE"

        target = kwargs["Target"]
        assert target["Arn"] == "arn:aws:lambda:us-east-1:123:function:deadline"
        assert target["RoleArn"] == "arn:aws:iam::123:role/scheduler"

        payload = json.loads(target["Input"])
        assert payload["source"] == "aws.scheduler"
        assert payload["league_id"] == str(league_id)


class TestScheduleDeadlineJobConflict:
    """Tests for ConflictException fallback to update_schedule."""

    @patch("app.services.scheduler_service._SCHEDULER_ROLE_ARN", "arn:aws:iam::123:role/scheduler")
    @patch("app.services.scheduler_service._DEADLINE_LAMBDA_ARN", "arn:aws:lambda:us-east-1:123:function:deadline")
    def test_conflict_triggers_update_fallback(self):
        """When create_schedule raises ConflictException, update_schedule is called."""
        from botocore.exceptions import ClientError
        from app.services.scheduler_service import schedule_deadline_job

        league_id = uuid4()
        future_date = date(2099, 7, 15)

        conflict_error = ClientError(
            {"Error": {"Code": "ConflictException", "Message": "Schedule already exists"}},
            "CreateSchedule",
        )
        mock_client = MagicMock()
        mock_client.create_schedule.side_effect = conflict_error

        with patch("boto3.client", return_value=mock_client):
            schedule_deadline_job(league_id, future_date)

        mock_client.update_schedule.assert_called_once()
        kwargs = mock_client.update_schedule.call_args[1]
        assert kwargs["Name"] == f"deadline-{league_id}"
        assert kwargs["ScheduleExpression"] == "at(2099-07-15T23:59:00)"

    @patch("app.services.scheduler_service._SCHEDULER_ROLE_ARN", "arn:aws:iam::123:role/scheduler")
    @patch("app.services.scheduler_service._DEADLINE_LAMBDA_ARN", "arn:aws:lambda:us-east-1:123:function:deadline")
    def test_resource_conflict_also_triggers_update(self):
        """ResourceConflictException also triggers the update fallback."""
        from botocore.exceptions import ClientError
        from app.services.scheduler_service import schedule_deadline_job

        league_id = uuid4()
        future_date = date(2099, 7, 15)

        conflict_error = ClientError(
            {"Error": {"Code": "ResourceConflictException", "Message": "Resource conflict"}},
            "CreateSchedule",
        )
        mock_client = MagicMock()
        mock_client.create_schedule.side_effect = conflict_error

        with patch("boto3.client", return_value=mock_client):
            schedule_deadline_job(league_id, future_date)

        mock_client.update_schedule.assert_called_once()


class TestScheduleDeadlineJobErrors:
    """Tests for non-conflict error handling."""

    @patch("app.services.scheduler_service._SCHEDULER_ROLE_ARN", "arn:aws:iam::123:role/scheduler")
    @patch("app.services.scheduler_service._DEADLINE_LAMBDA_ARN", "arn:aws:lambda:us-east-1:123:function:deadline")
    def test_non_conflict_exception_is_logged(self, caplog):
        """Non-conflict exceptions are logged, not raised."""
        from botocore.exceptions import ClientError
        from app.services.scheduler_service import schedule_deadline_job

        league_id = uuid4()
        future_date = date(2099, 7, 15)

        access_denied = ClientError(
            {"Error": {"Code": "AccessDeniedException", "Message": "Not authorized"}},
            "CreateSchedule",
        )
        mock_client = MagicMock()
        mock_client.create_schedule.side_effect = access_denied

        with caplog.at_level(logging.ERROR, logger="app.services.scheduler_service"):
            with patch("boto3.client", return_value=mock_client):
                # Should not raise
                schedule_deadline_job(league_id, future_date)

        mock_client.update_schedule.assert_not_called()
        assert "Failed to create EventBridge schedule" in caplog.text

    @patch("app.services.scheduler_service._SCHEDULER_ROLE_ARN", "arn:aws:iam::123:role/scheduler")
    @patch("app.services.scheduler_service._DEADLINE_LAMBDA_ARN", "arn:aws:lambda:us-east-1:123:function:deadline")
    def test_generic_exception_is_logged(self, caplog):
        """Non-ClientError exceptions are also logged, not raised."""
        from app.services.scheduler_service import schedule_deadline_job

        league_id = uuid4()
        future_date = date(2099, 7, 15)

        mock_client = MagicMock()
        mock_client.create_schedule.side_effect = RuntimeError("boto3 exploded")

        with caplog.at_level(logging.ERROR, logger="app.services.scheduler_service"):
            with patch("boto3.client", return_value=mock_client):
                schedule_deadline_job(league_id, future_date)

        assert "Failed to create EventBridge schedule" in caplog.text

    @patch("app.services.scheduler_service._SCHEDULER_ROLE_ARN", "arn:aws:iam::123:role/scheduler")
    @patch("app.services.scheduler_service._DEADLINE_LAMBDA_ARN", "arn:aws:lambda:us-east-1:123:function:deadline")
    def test_update_failure_after_conflict_is_logged(self, caplog):
        """If update_schedule also fails after a conflict, the error is logged."""
        from botocore.exceptions import ClientError
        from app.services.scheduler_service import schedule_deadline_job

        league_id = uuid4()
        future_date = date(2099, 7, 15)

        conflict_error = ClientError(
            {"Error": {"Code": "ConflictException", "Message": "Conflict"}},
            "CreateSchedule",
        )
        mock_client = MagicMock()
        mock_client.create_schedule.side_effect = conflict_error
        mock_client.update_schedule.side_effect = RuntimeError("Update also failed")

        with caplog.at_level(logging.ERROR, logger="app.services.scheduler_service"):
            with patch("boto3.client", return_value=mock_client):
                schedule_deadline_job(league_id, future_date)

        assert "Failed to update EventBridge schedule" in caplog.text
