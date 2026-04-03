"""Unit tests for app.utils.clerk_jwt — JWKS caching, signing key extraction,
email fetching, get_optional_user, get_current_user, and test bypass."""

import asyncio
import time
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import jwt as pyjwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException
from jwt import algorithms as jwt_algorithms

from app.utils.clerk_jwt import (
    JWKS_CACHE,
    JWKS_CACHE_TTL,
    _CLERK_ISSUER_NORMALIZED,
    _fetch_clerk_email,
    _get_signing_key,
    _get_test_bypass_user,
    get_current_user,
    get_jwks,
    get_optional_user,
)


# ---------------------------------------------------------------------------
# RSA key fixtures
# ---------------------------------------------------------------------------

def _generate_rsa_key_pair():
    """Generate an RSA private key and derive the public key + JWK dict."""
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_key = private_key.public_key()
    # Build a JWK dict from the public key
    jwk_dict = jwt_algorithms.RSAAlgorithm.to_jwk(public_key, as_dict=True)
    jwk_dict["kid"] = "test-kid-1"
    jwk_dict["use"] = "sig"
    jwk_dict["alg"] = "RS256"
    return private_key, public_key, jwk_dict


PRIVATE_KEY, PUBLIC_KEY, JWK_DICT = _generate_rsa_key_pair()


def _make_token(payload: dict, kid: str = "test-kid-1"):
    """Create a signed JWT using the test RSA private key."""
    return pyjwt.encode(payload, PRIVATE_KEY, algorithm="RS256", headers={"kid": kid})


class _FakeHeaders(dict):
    """A dict subclass that behaves like Starlette Headers for test purposes."""
    pass


def _make_request(token: str | None = None) -> MagicMock:
    """Build a mock FastAPI Request with an optional Authorization header."""
    request = MagicMock()
    if token is not None:
        request.headers = _FakeHeaders({"Authorization": f"Bearer {token}"})
    else:
        request.headers = _FakeHeaders()
    return request


@pytest.fixture(autouse=True)
def _reset_jwks_cache():
    """Clear JWKS cache before each test."""
    JWKS_CACHE["keys"] = None
    JWKS_CACHE["fetched_at"] = 0
    yield
    JWKS_CACHE["keys"] = None
    JWKS_CACHE["fetched_at"] = 0


# ===================================================================
# 1. JWKS caching
# ===================================================================

@pytest.mark.asyncio
async def test_get_jwks_cache_miss_fetches():
    """First call should fetch JWKS via HTTP."""
    mock_resp = MagicMock()
    mock_resp.json.return_value = {"keys": [JWK_DICT]}
    mock_resp.raise_for_status = MagicMock()

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_resp)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch("app.utils.clerk_jwt.httpx.AsyncClient", return_value=mock_client):
        result = await get_jwks()

    assert result == {"keys": [JWK_DICT]}
    mock_client.get.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_jwks_cache_hit_skips_fetch():
    """Subsequent calls within TTL should return cached data without HTTP."""
    JWKS_CACHE["keys"] = {"keys": [JWK_DICT]}
    JWKS_CACHE["fetched_at"] = int(time.time())

    with patch("app.utils.clerk_jwt.httpx.AsyncClient") as mock_cls:
        result = await get_jwks()

    assert result == {"keys": [JWK_DICT]}
    mock_cls.assert_not_called()


@pytest.mark.asyncio
async def test_get_jwks_cache_expiry_refetches():
    """Expired cache should trigger a new HTTP fetch."""
    JWKS_CACHE["keys"] = {"keys": [{"kid": "old"}]}
    JWKS_CACHE["fetched_at"] = int(time.time()) - JWKS_CACHE_TTL - 10

    new_jwks = {"keys": [JWK_DICT]}
    mock_resp = MagicMock()
    mock_resp.json.return_value = new_jwks
    mock_resp.raise_for_status = MagicMock()

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_resp)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch("app.utils.clerk_jwt.httpx.AsyncClient", return_value=mock_client):
        result = await get_jwks()

    assert result == new_jwks
    mock_client.get.assert_awaited_once()


@pytest.mark.asyncio
async def test_get_jwks_lock_dedup():
    """Concurrent callers should only trigger one HTTP fetch (lock dedup)."""
    fetch_count = 0
    original_keys = {"keys": [JWK_DICT]}

    async def fake_get(*args, **kwargs):
        nonlocal fetch_count
        fetch_count += 1
        await asyncio.sleep(0.05)  # simulate latency
        resp = MagicMock()
        resp.json.return_value = original_keys
        resp.raise_for_status = MagicMock()
        return resp

    mock_client = AsyncMock()
    mock_client.get = fake_get
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch("app.utils.clerk_jwt.httpx.AsyncClient", return_value=mock_client):
        results = await asyncio.gather(get_jwks(), get_jwks(), get_jwks())

    # All should get the same result
    for r in results:
        assert r == original_keys
    # Only one HTTP call should have been made (the second and third find cache populated after lock)
    assert fetch_count == 1


# ===================================================================
# 2. Signing key extraction
# ===================================================================

def test_get_signing_key_success():
    """Should return the RSA public key when kid matches."""
    jwks = {"keys": [JWK_DICT]}
    token = _make_token({"sub": "user_123"}, kid="test-kid-1")
    key = _get_signing_key(jwks, token)
    assert key is not None
    # Verify the key can decode the token
    payload = pyjwt.decode(token, key, algorithms=["RS256"], options={"verify_aud": False, "verify_iss": False})
    assert payload["sub"] == "user_123"


def test_get_signing_key_no_matching_kid():
    """Should raise 401 HTTPException when no key matches the token's kid."""
    jwks = {"keys": [JWK_DICT]}  # kid = "test-kid-1"
    token = _make_token({"sub": "user_123"}, kid="unknown-kid")
    with pytest.raises(HTTPException) as exc_info:
        _get_signing_key(jwks, token)
    assert exc_info.value.status_code == 401
    assert "signing key" in exc_info.value.detail.lower()


# ===================================================================
# 3. Email fetching
# ===================================================================

@pytest.mark.asyncio
async def test_fetch_clerk_email_primary():
    """Should return the primary email address."""
    api_response = {
        "email_addresses": [
            {"id": "email_other", "email_address": "other@example.com"},
            {"id": "email_primary", "email_address": "primary@example.com"},
        ],
        "primary_email_address_id": "email_primary",
    }

    mock_resp = MagicMock()
    mock_resp.json.return_value = api_response
    mock_resp.raise_for_status = MagicMock()

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_resp)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch("app.utils.clerk_jwt.httpx.AsyncClient", return_value=mock_client):
        email = await _fetch_clerk_email("user_abc")

    assert email == "primary@example.com"


@pytest.mark.asyncio
async def test_fetch_clerk_email_fallback_first():
    """Should fall back to first email when primary_email_address_id does not match."""
    api_response = {
        "email_addresses": [
            {"id": "email_1", "email_address": "first@example.com"},
        ],
        "primary_email_address_id": "nonexistent_id",
    }

    mock_resp = MagicMock()
    mock_resp.json.return_value = api_response
    mock_resp.raise_for_status = MagicMock()

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_resp)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch("app.utils.clerk_jwt.httpx.AsyncClient", return_value=mock_client):
        email = await _fetch_clerk_email("user_abc")

    assert email == "first@example.com"


@pytest.mark.asyncio
async def test_fetch_clerk_email_no_emails():
    """Should raise 401 when user has no email addresses."""
    api_response = {"email_addresses": [], "primary_email_address_id": None}

    mock_resp = MagicMock()
    mock_resp.json.return_value = api_response
    mock_resp.raise_for_status = MagicMock()

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_resp)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch("app.utils.clerk_jwt.httpx.AsyncClient", return_value=mock_client):
        with pytest.raises(HTTPException) as exc_info:
            await _fetch_clerk_email("user_abc")
    assert exc_info.value.status_code == 401
    assert "no email" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_fetch_clerk_email_timeout():
    """Should raise 503 on Clerk API timeout."""
    mock_client = AsyncMock()
    mock_client.get = AsyncMock(side_effect=httpx.TimeoutException("timed out"))
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch("app.utils.clerk_jwt.httpx.AsyncClient", return_value=mock_client):
        with pytest.raises(HTTPException) as exc_info:
            await _fetch_clerk_email("user_abc")
    assert exc_info.value.status_code == 503


@pytest.mark.asyncio
async def test_fetch_clerk_email_http_error():
    """Should raise 401 on Clerk API HTTP error (e.g. 404)."""
    mock_resp = MagicMock(status_code=404)
    mock_resp.raise_for_status.side_effect = httpx.HTTPStatusError(
        "Not Found", request=MagicMock(), response=mock_resp
    )

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_resp)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    with patch("app.utils.clerk_jwt.httpx.AsyncClient", return_value=mock_client):
        with pytest.raises(HTTPException) as exc_info:
            await _fetch_clerk_email("user_abc")
    assert exc_info.value.status_code == 401


# ===================================================================
# 4. get_optional_user
# ===================================================================

@pytest.mark.asyncio
async def test_optional_user_no_header():
    """No Authorization header should return None."""
    request = _make_request(token=None)
    with patch("app.utils.clerk_jwt._get_test_bypass_user", return_value=None):
        result = await get_optional_user(request)
    assert result is None


@pytest.mark.asyncio
async def test_optional_user_invalid_token():
    """An invalid/malformed token should return None (no exception)."""
    request = _make_request(token="not.a.valid.jwt")
    with patch("app.utils.clerk_jwt._get_test_bypass_user", return_value=None):
        result = await get_optional_user(request)
    assert result is None


@pytest.mark.asyncio
async def test_optional_user_valid_token():
    """A valid token should return {'id': sub}."""
    token = _make_token({"sub": "user_xyz", "iss": _CLERK_ISSUER_NORMALIZED, "exp": int(time.time()) + 300})
    request = _make_request(token=token)

    JWKS_CACHE["keys"] = {"keys": [JWK_DICT]}
    JWKS_CACHE["fetched_at"] = int(time.time())

    with patch("app.utils.clerk_jwt._get_test_bypass_user", return_value=None):
        result = await get_optional_user(request)

    assert result == {"id": "user_xyz"}


@pytest.mark.asyncio
async def test_optional_user_no_sub_returns_none():
    """A valid JWT with no 'sub' claim should return None."""
    token = _make_token({"iss": _CLERK_ISSUER_NORMALIZED, "exp": int(time.time()) + 300})
    request = _make_request(token=token)

    JWKS_CACHE["keys"] = {"keys": [JWK_DICT]}
    JWKS_CACHE["fetched_at"] = int(time.time())

    with patch("app.utils.clerk_jwt._get_test_bypass_user", return_value=None):
        result = await get_optional_user(request)

    assert result is None


# ===================================================================
# 5. get_current_user
# ===================================================================

@pytest.mark.asyncio
async def test_current_user_no_header_raises_401():
    """Missing Authorization header should raise 401."""
    request = _make_request(token=None)
    with patch("app.utils.clerk_jwt._get_test_bypass_user", return_value=None):
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(request)
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_current_user_valid_token():
    """A valid token with email in payload should return full user dict."""
    token = _make_token({
        "sub": "user_abc",
        "iss": _CLERK_ISSUER_NORMALIZED,
        "exp": int(time.time()) + 300,
        "email": "alice@example.com",
    })
    request = _make_request(token=token)

    JWKS_CACHE["keys"] = {"keys": [JWK_DICT]}
    JWKS_CACHE["fetched_at"] = int(time.time())

    with patch("app.utils.clerk_jwt._get_test_bypass_user", return_value=None):
        result = await get_current_user(request)

    assert result["id"] == "user_abc"
    assert result["sub"] == "user_abc"
    assert result["email"] == "alice@example.com"


@pytest.mark.asyncio
async def test_current_user_issuer_mismatch_logs(caplog):
    """Issuer mismatch should be logged but token still validated (if signature is valid)."""
    wrong_issuer = "https://wrong.clerk.dev"
    token = _make_token({
        "sub": "user_abc",
        "iss": wrong_issuer,
        "exp": int(time.time()) + 300,
        "email": "alice@example.com",
    })
    request = _make_request(token=token)

    JWKS_CACHE["keys"] = {"keys": [JWK_DICT]}
    JWKS_CACHE["fetched_at"] = int(time.time())

    with patch("app.utils.clerk_jwt._get_test_bypass_user", return_value=None):
        # The issuer mismatch will cause pyjwt.decode to raise InvalidIssuerError
        # which is a PyJWTError, so it raises 401.
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(request)

    assert exc_info.value.status_code == 401
    # The logger should have logged the mismatch before the decode attempt
    assert any("Issuer mismatch" in r.message for r in caplog.records)


@pytest.mark.asyncio
async def test_current_user_jwt_error_raises_401():
    """Expired or otherwise invalid JWT should raise 401."""
    token = _make_token({
        "sub": "user_abc",
        "iss": _CLERK_ISSUER_NORMALIZED,
        "exp": int(time.time()) - 600,  # expired
    })
    request = _make_request(token=token)

    JWKS_CACHE["keys"] = {"keys": [JWK_DICT]}
    JWKS_CACHE["fetched_at"] = int(time.time())

    with patch("app.utils.clerk_jwt._get_test_bypass_user", return_value=None):
        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(request)
    assert exc_info.value.status_code == 401
    assert "expired" in exc_info.value.detail.lower() or "invalid" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_current_user_fetches_email_if_missing():
    """When JWT has no email claim, get_current_user should call _fetch_clerk_email."""
    token = _make_token({
        "sub": "user_no_email",
        "iss": _CLERK_ISSUER_NORMALIZED,
        "exp": int(time.time()) + 300,
    })
    request = _make_request(token=token)

    JWKS_CACHE["keys"] = {"keys": [JWK_DICT]}
    JWKS_CACHE["fetched_at"] = int(time.time())

    with patch("app.utils.clerk_jwt._get_test_bypass_user", return_value=None), \
         patch("app.utils.clerk_jwt._fetch_clerk_email", new_callable=AsyncMock, return_value="fetched@example.com") as mock_fetch:
        result = await get_current_user(request)

    mock_fetch.assert_awaited_once_with("user_no_email")
    assert result["email"] == "fetched@example.com"
    assert result["id"] == "user_no_email"


# ===================================================================
# 6. Test bypass
# ===================================================================

def test_bypass_enabled_returns_user():
    """When TESTING=true and token matches, should return hardcoded user."""
    request = _make_request(token="my-bypass-secret")
    with patch("app.utils.clerk_jwt._TESTING", True), \
         patch("app.utils.clerk_jwt._TEST_BYPASS_TOKEN", "my-bypass-secret"):
        result = _get_test_bypass_user(request)
    assert result is not None
    assert result["id"] == "test_user_id"
    assert result["email"] == "testuser@example.com"


def test_bypass_disabled_returns_none():
    """When TESTING is false, bypass should return None even with valid token."""
    request = _make_request(token="my-bypass-secret")
    with patch("app.utils.clerk_jwt._TESTING", False), \
         patch("app.utils.clerk_jwt._TEST_BYPASS_TOKEN", "my-bypass-secret"):
        result = _get_test_bypass_user(request)
    assert result is None


def test_bypass_wrong_token_returns_none():
    """When token does not match TEST_BYPASS_TOKEN, should return None."""
    request = _make_request(token="wrong-token")
    with patch("app.utils.clerk_jwt._TESTING", True), \
         patch("app.utils.clerk_jwt._TEST_BYPASS_TOKEN", "my-bypass-secret"):
        result = _get_test_bypass_user(request)
    assert result is None


def test_bypass_empty_token_returns_none():
    """When TEST_BYPASS_TOKEN is empty, bypass should return None."""
    request = _make_request(token="anything")
    with patch("app.utils.clerk_jwt._TESTING", True), \
         patch("app.utils.clerk_jwt._TEST_BYPASS_TOKEN", ""):
        result = _get_test_bypass_user(request)
    assert result is None
