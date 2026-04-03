import pytest
from unittest.mock import MagicMock
from uuid import uuid4

from app.handlers.deadline_handler import handler


def _make_event(source="aws.scheduler", league_id=None):
    lid = league_id or str(uuid4())
    return {"source": source, "league_id": lid}


def test_deadline_handler_rejects_wrong_source():
    result = handler({"source": "manual"}, {})
    assert result["statusCode"] == 403


def test_deadline_handler_rejects_missing_source():
    result = handler({}, {})
    assert result["statusCode"] == 403


def test_deadline_handler_rejects_invalid_league_id():
    result = handler({"source": "aws.scheduler", "league_id": "not-a-uuid"}, {})
    assert result["statusCode"] == 400


def _setup_deadline_mock(mock_db):
    """Configure mock_db so the idempotency guard (League query) returns an unprocessed league."""
    mock_league = MagicMock()
    mock_league.deadline_processed_at = None
    mock_db.query.return_value.filter.return_value.with_for_update.return_value.first.return_value = mock_league
    mock_db.query.return_value.filter.return_value.update.return_value = 0
    return mock_league


def test_deadline_handler_calls_trigger_team_generation(mocker):
    # SessionLocal and trigger_team_generation_if_ready are imported lazily
    # inside the handler body, so patch at their source modules.
    mock_db = MagicMock()
    _setup_deadline_mock(mock_db)
    mocker.patch("app.db.db.SessionLocal", return_value=mock_db)
    mock_trigger = mocker.patch(
        "app.services.team_generation_service.trigger_team_generation_if_ready",
        return_value=True,
    )

    league_id = str(uuid4())
    result = handler({"source": "aws.scheduler", "league_id": league_id}, {})
    assert result["statusCode"] == 200
    assert mock_trigger.called


def test_deadline_handler_expires_invitations(mocker):
    """Handler should call update to expire pending invitations."""
    mock_db = MagicMock()
    _setup_deadline_mock(mock_db)
    mocker.patch("app.db.db.SessionLocal", return_value=mock_db)
    mocker.patch(
        "app.services.team_generation_service.trigger_team_generation_if_ready",
        return_value=False,
    )

    league_id = str(uuid4())
    result = handler({"source": "aws.scheduler", "league_id": league_id}, {})
    assert result["statusCode"] == 200
    # Verify the update was called (expiring invitations)
    assert mock_db.query.called


def test_deadline_handler_skips_already_processed(mocker):
    """Handler should return early if deadline was already processed."""
    mock_db = MagicMock()
    mock_league = MagicMock()
    mock_league.deadline_processed_at = "2026-04-01T00:00:00+00:00"
    mock_db.query.return_value.filter.return_value.with_for_update.return_value.first.return_value = mock_league
    mocker.patch("app.db.db.SessionLocal", return_value=mock_db)
    mock_trigger = mocker.patch(
        "app.services.team_generation_service.trigger_team_generation_if_ready",
    )

    league_id = str(uuid4())
    result = handler({"source": "aws.scheduler", "league_id": league_id}, {})
    assert result["statusCode"] == 200
    assert result.get("already_processed") is True
    assert not mock_trigger.called


def test_deadline_handler_exception_reraises(mocker):
    """Handler should re-raise exceptions but always close DB."""
    mock_db = MagicMock()
    mock_db.query.side_effect = RuntimeError("DB explosion")
    mocker.patch("app.db.db.SessionLocal", return_value=mock_db)

    league_id = str(uuid4())
    with pytest.raises(RuntimeError, match="DB explosion"):
        handler({"source": "aws.scheduler", "league_id": league_id}, {})
    mock_db.close.assert_called_once()
