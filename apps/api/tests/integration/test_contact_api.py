"""Integration tests for the contact endpoint (POST /contact)."""

import pytest
from unittest.mock import patch, AsyncMock
from fastapi import HTTPException
from pydantic import ValidationError

from app.api.schemas.contact import ContactRequest
from app.core.limiter import limiter


@pytest.fixture(autouse=True)
def _disable_rate_limit():
    """Disable slowapi rate limiting for all tests in this module."""
    limiter.enabled = False
    yield
    limiter.enabled = True


CONTACT_PAYLOAD = {
    "name": "Test User",
    "email": "test@example.com",
    "subject": "Hello",
    "message": "Test message body",
    "recaptcha_token": "fake-token",
}


# ---------------------------------------------------------------------------
# Contact form submission tests
# ---------------------------------------------------------------------------


@patch("app.api.contact.send_contact_message")
@patch("app.api.contact.verify_recaptcha", new_callable=AsyncMock, return_value=True)
@patch("app.api.contact.settings.CONTACT_EMAIL", "admin@example.com", create=True)
@patch("app.api.contact.settings.RECAPTCHA_SECRET_KEY", "test-secret", create=True)
def test_contact_success(mock_recaptcha, mock_send, client):
    """Successful contact form submission returns 200."""
    resp = client.post("/contact", json=CONTACT_PAYLOAD)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "sent" in data["message"].lower()
    mock_recaptcha.assert_awaited_once_with(CONTACT_PAYLOAD["recaptcha_token"])
    mock_send.assert_called_once()


@patch("app.api.contact.settings.RECAPTCHA_SECRET_KEY", "", create=True)
def test_contact_missing_recaptcha_key(client):
    """Returns 503 when RECAPTCHA_SECRET_KEY is empty."""
    resp = client.post("/contact", json=CONTACT_PAYLOAD)
    assert resp.status_code == 503
    assert "unavailable" in resp.json()["detail"].lower()


@patch("app.api.contact.send_contact_message")
@patch("app.api.contact.verify_recaptcha", new_callable=AsyncMock, return_value=False)
@patch("app.api.contact.settings.RECAPTCHA_SECRET_KEY", "test-secret", create=True)
def test_contact_recaptcha_fails(mock_recaptcha, mock_send, client):
    """Returns 400 when reCAPTCHA verification returns success=false."""
    resp = client.post("/contact", json=CONTACT_PAYLOAD)
    assert resp.status_code == 400
    assert "recaptcha" in resp.json()["detail"].lower()
    mock_send.assert_not_called()


@patch(
    "app.api.contact.verify_recaptcha",
    new_callable=AsyncMock,
    side_effect=HTTPException(status_code=503, detail="Service temporarily unavailable."),
)
@patch("app.api.contact.settings.RECAPTCHA_SECRET_KEY", "test-secret", create=True)
def test_contact_recaptcha_timeout(mock_recaptcha, client):
    """Returns 503 when reCAPTCHA verification times out."""
    resp = client.post("/contact", json=CONTACT_PAYLOAD)
    assert resp.status_code == 503


@patch("app.api.contact.verify_recaptcha", new_callable=AsyncMock, return_value=True)
@patch("app.api.contact.settings.CONTACT_EMAIL", "", create=True)
@patch("app.api.contact.settings.RECAPTCHA_SECRET_KEY", "test-secret", create=True)
def test_contact_missing_contact_email(mock_recaptcha, client):
    """Returns 500 when CONTACT_EMAIL is empty."""
    resp = client.post("/contact", json=CONTACT_PAYLOAD)
    assert resp.status_code == 500
    assert "not configured" in resp.json()["detail"].lower()


@patch(
    "app.api.contact.send_contact_message",
    side_effect=Exception("SMTP error"),
)
@patch("app.api.contact.verify_recaptcha", new_callable=AsyncMock, return_value=True)
@patch("app.api.contact.settings.CONTACT_EMAIL", "admin@example.com", create=True)
@patch("app.api.contact.settings.RECAPTCHA_SECRET_KEY", "test-secret", create=True)
def test_contact_email_send_failure(mock_recaptcha, mock_send, client):
    """Returns 500 when send_contact_message raises."""
    resp = client.post("/contact", json=CONTACT_PAYLOAD)
    assert resp.status_code == 500
    assert "failed" in resp.json()["detail"].lower()


# ---------------------------------------------------------------------------
# Pydantic validator tests (ContactRequest model)
# ---------------------------------------------------------------------------


def test_name_validation_empty():
    """Empty name raises ValidationError."""
    with pytest.raises(ValidationError):
        ContactRequest(
            name="",
            email="a@b.com",
            subject="s",
            message="m",
            recaptcha_token="t",
        )


def test_name_validation_too_long():
    """Name exceeding 100 characters raises ValidationError."""
    with pytest.raises(ValidationError):
        ContactRequest(
            name="A" * 101,
            email="a@b.com",
            subject="s",
            message="m",
            recaptcha_token="t",
        )


def test_name_html_escaped():
    """HTML in name field is escaped."""
    req = ContactRequest(
        name="<script>alert('xss')</script>",
        email="a@b.com",
        subject="Hello",
        message="body",
        recaptcha_token="t",
    )
    assert "<script>" not in req.name
    assert "&lt;script&gt;" in req.name


def test_subject_validation_empty():
    """Empty subject raises ValidationError."""
    with pytest.raises(ValidationError):
        ContactRequest(
            name="Test",
            email="a@b.com",
            subject="",
            message="m",
            recaptcha_token="t",
        )


def test_message_validation_too_long():
    """Message exceeding 2000 characters raises ValidationError."""
    with pytest.raises(ValidationError):
        ContactRequest(
            name="Test",
            email="a@b.com",
            subject="Hello",
            message="A" * 2001,
            recaptcha_token="t",
        )


def test_subject_html_escaped():
    """HTML in subject field is escaped."""
    req = ContactRequest(
        name="Test",
        email="a@b.com",
        subject="<b>bold</b>",
        message="body",
        recaptcha_token="t",
    )
    assert "<b>" not in req.subject


def test_message_html_escaped():
    """HTML in message field is escaped."""
    req = ContactRequest(
        name="Test",
        email="a@b.com",
        subject="Hello",
        message="<img src=x onerror=alert(1)>",
        recaptcha_token="t",
    )
    assert "<img" not in req.message


# ---------------------------------------------------------------------------
# verify_recaptcha direct tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_verify_recaptcha_success():
    """verify_recaptcha returns True for high-score success response."""
    from unittest.mock import MagicMock
    from app.utils.recaptcha import verify_recaptcha

    mock_response = MagicMock()
    mock_response.json.return_value = {"success": True, "score": 0.9}
    mock_response.raise_for_status = MagicMock()

    mock_client = AsyncMock()
    mock_client.post.return_value = mock_response

    with patch("app.utils.recaptcha.httpx.AsyncClient") as MockClient:
        MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await verify_recaptcha("test-token")
        assert result is True


@pytest.mark.asyncio
async def test_verify_recaptcha_low_score():
    """verify_recaptcha returns False for low-score response."""
    from unittest.mock import MagicMock
    from app.utils.recaptcha import verify_recaptcha

    mock_response = MagicMock()
    mock_response.json.return_value = {"success": True, "score": 0.2}
    mock_response.raise_for_status = MagicMock()

    mock_client = AsyncMock()
    mock_client.post.return_value = mock_response

    with patch("app.utils.recaptcha.httpx.AsyncClient") as MockClient:
        MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await verify_recaptcha("test-token")
        assert result is False


@pytest.mark.asyncio
async def test_verify_recaptcha_timeout_direct():
    """verify_recaptcha raises 503 on timeout."""
    import httpx
    from app.utils.recaptcha import verify_recaptcha

    mock_client = AsyncMock()
    mock_client.post.side_effect = httpx.TimeoutException("timed out")

    with patch("app.utils.recaptcha.httpx.AsyncClient") as MockClient:
        MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        with pytest.raises(HTTPException) as exc_info:
            await verify_recaptcha("test-token")
        assert exc_info.value.status_code == 503


@pytest.mark.asyncio
async def test_verify_recaptcha_other_error():
    """verify_recaptcha raises 400 on other exceptions."""
    from app.utils.recaptcha import verify_recaptcha

    mock_client = AsyncMock()
    mock_client.post.side_effect = RuntimeError("network error")

    with patch("app.utils.recaptcha.httpx.AsyncClient") as MockClient:
        MockClient.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        with pytest.raises(HTTPException) as exc_info:
            await verify_recaptcha("test-token")
        assert exc_info.value.status_code == 400
