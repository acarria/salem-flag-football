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


def test_deadline_handler_calls_trigger_team_generation(mocker):
    # SessionLocal and trigger_team_generation_if_ready are imported lazily
    # inside the handler body, so patch at their source modules.
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.update.return_value = 0
    mocker.patch("app.db.db.SessionLocal", return_value=mock_db)
    mock_trigger = mocker.patch(
        "app.services.team_generation_service.trigger_team_generation_if_ready",
        return_value=True,
    )

    league_id = str(uuid4())
    result = handler({"source": "aws.scheduler", "league_id": league_id}, {})
    assert result["statusCode"] == 200
    assert mock_trigger.called
