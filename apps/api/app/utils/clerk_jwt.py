import asyncio
import httpx
import logging
import os
import time
import urllib.parse

import jwt as pyjwt
from jwt import algorithms as jwt_algorithms
from jwt.exceptions import PyJWTError
from fastapi import HTTPException, status, Request
from app.core.config import settings

logger = logging.getLogger(__name__)

JWKS_CACHE = {"keys": None, "fetched_at": 0, "failed_at": 0}
JWKS_CACHE_TTL = 60 * 60  # 1 hour
_JWKS_NEGATIVE_TTL = 30  # seconds to wait before retrying after a failure
_JWKS_LOCK = asyncio.Lock()

# Per-user email cache — avoids hitting Clerk API on every authenticated request
_EMAIL_CACHE: dict[str, tuple[str, float]] = {}  # {user_id: (email, fetched_at)}
_EMAIL_CACHE_TTL = 300  # 5 minutes

# Normalize issuer: strip trailing slash so both "…dev" and "…dev/" validate.
_CLERK_ISSUER_NORMALIZED = settings.CLERK_ISSUER.rstrip("/")
_CLERK_JWT_AUDIENCE = settings.CLERK_JWT_AUDIENCE or None  # None disables aud check


def _jwt_decode_options() -> dict:
    """Return PyJWT decode kwargs for audience verification."""
    opts: dict = {"verify_aud": bool(_CLERK_JWT_AUDIENCE)}
    return opts


def _jwt_decode_kwargs() -> dict:
    """Return extra kwargs (audience) for pyjwt.decode."""
    if _CLERK_JWT_AUDIENCE:
        return {"audience": _CLERK_JWT_AUDIENCE}
    return {}

async def get_jwks():
    now = int(time.time())
    if JWKS_CACHE["keys"] and now - JWKS_CACHE["fetched_at"] < JWKS_CACHE_TTL:
        return JWKS_CACHE["keys"]
    # Negative cache: avoid hammering a failing upstream on cold start
    if not JWKS_CACHE["keys"] and JWKS_CACHE["failed_at"] and now - JWKS_CACHE["failed_at"] < _JWKS_NEGATIVE_TTL:
        raise RuntimeError("JWKS fetch recently failed; retrying after cooldown")
    async with _JWKS_LOCK:
        # Re-check after acquiring lock (another coroutine may have refreshed)
        if JWKS_CACHE["keys"] and now - JWKS_CACHE["fetched_at"] < JWKS_CACHE_TTL:
            return JWKS_CACHE["keys"]
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(settings.CLERK_JWKS_URL)
                resp.raise_for_status()
                JWKS_CACHE["keys"] = resp.json()
                JWKS_CACHE["fetched_at"] = int(time.time())
                JWKS_CACHE["failed_at"] = 0
        except Exception as exc:
            if JWKS_CACHE["keys"]:
                logger.warning(
                    "JWKS fetch failed (%s); using stale cache (age=%ds)",
                    exc, now - JWKS_CACHE["fetched_at"],
                )
            else:
                JWKS_CACHE["failed_at"] = int(time.time())
                raise
        return JWKS_CACHE["keys"]


def _get_signing_key(jwks: dict, token: str):
    """Extract the RSA signing key from JWKS that matches the token's kid header."""
    header = pyjwt.get_unverified_header(token)
    kid = header.get("kid")
    for jwk in jwks.get("keys", []):
        if jwk.get("kid") == kid:
            return jwt_algorithms.RSAAlgorithm.from_jwk(jwk)
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unable to find signing key for token",
    )


async def _fetch_clerk_email(user_id: str) -> str:
    """Fetch primary email for a Clerk user via the backend API. Cached for 5 minutes."""
    now = time.time()
    cached = _EMAIL_CACHE.get(user_id)
    if cached and now - cached[1] < _EMAIL_CACHE_TTL:
        return cached[0]

    url = f"https://api.clerk.com/v1/users/{urllib.parse.quote(user_id, safe='')}"
    headers = {"Authorization": f"Bearer {settings.CLERK_SECRET_KEY}"}
    data = None
    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(url, headers=headers)
                resp.raise_for_status()
                data = resp.json()
                break
        except httpx.TimeoutException:
            if attempt < 2:
                await asyncio.sleep(0.5 * (2 ** attempt))
                continue
            logger.error("Clerk API timed out fetching email for user %s (after %d retries)", user_id, attempt + 1)
            raise HTTPException(status_code=503, detail="Authentication service unavailable. Please retry.")
        except httpx.HTTPStatusError as e:
            if e.response.status_code < 500:
                logger.error("Clerk API error fetching email for user %s: %s", user_id, e.response.status_code)
                raise HTTPException(status_code=401, detail="Unable to verify user identity.")
            if attempt < 2:
                await asyncio.sleep(0.5 * (2 ** attempt))
                continue
            logger.error("Clerk API error fetching email for user %s: %s (after %d retries)", user_id, e.response.status_code, attempt + 1)
            raise HTTPException(status_code=503, detail="Authentication service unavailable. Please retry.")
    addresses = data.get("email_addresses", [])
    primary_id = data.get("primary_email_address_id")
    email = None
    for addr in addresses:
        if addr.get("id") == primary_id:
            email = addr["email_address"]
            break
    if not email and addresses:
        email = addresses[0]["email_address"]
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No email found for user")
    _EMAIL_CACHE[user_id] = (email, now)
    return email

_TESTING = os.getenv("TESTING") == "true"
_TEST_BYPASS_TOKEN = os.getenv("TEST_BYPASS_TOKEN", "")

if _TESTING and _TEST_BYPASS_TOKEN and len(_TEST_BYPASS_TOKEN) < 32:
    logger.warning("TEST_BYPASS_TOKEN is shorter than 32 characters — use a stronger token")


def _get_test_bypass_user(request: Request) -> dict | None:
    """Return a hardcoded user dict if TEST_BYPASS_TOKEN is present and TESTING=true.
    Only active when TESTING=true env var is set. Never active in production."""
    if not _TESTING or not _TEST_BYPASS_TOKEN:
        return None
    auth_header = request.headers.get("Authorization", "")
    if auth_header == f"Bearer {_TEST_BYPASS_TOKEN}":
        return {
            "id": "test_user_id",
            "email": "testuser@example.com",
            "sub": "test_user_id",
        }
    return None


async def get_optional_user(request: Request):
    """Like get_current_user but returns None instead of raising for missing/invalid tokens.
    Safe to use on public endpoints that optionally personalise their response.
    Does NOT call _fetch_clerk_email — user_id only."""
    if bypass := _get_test_bypass_user(request):
        return bypass
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ", 1)[1]
    try:
        jwks = await get_jwks()
        key = _get_signing_key(jwks, token)
        payload = pyjwt.decode(
            token,
            key,
            algorithms=["RS256"],
            options=_jwt_decode_options(),
            issuer=_CLERK_ISSUER_NORMALIZED,
            **_jwt_decode_kwargs(),
        )
        user_id = payload.get("sub")
        if not user_id:
            return None
        return {"id": user_id}
    except Exception:
        return None


async def get_current_user(request: Request):
    if bypass := _get_test_bypass_user(request):
        return bypass
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing or invalid Authorization header")

    token = auth_header.split(" ", 1)[1]

    try:
        jwks = await get_jwks()
        key = _get_signing_key(jwks, token)
        try:
            payload = pyjwt.decode(
                token,
                key,
                algorithms=["RS256"],
                options=_jwt_decode_options(),
                issuer=_CLERK_ISSUER_NORMALIZED,
                **_jwt_decode_kwargs(),
            )
        except pyjwt.exceptions.InvalidIssuerError:
            # Diagnostic: decode without verification to log the mismatched issuer
            try:
                unverified = pyjwt.decode(
                    token,
                    options={"verify_signature": False, "verify_exp": False, "verify_iss": False, "verify_aud": False},
                )
                token_iss = str(unverified.get("iss", ""))[:200]
                logger.error(
                    "Issuer mismatch — token iss=%r, configured CLERK_ISSUER=%r",
                    token_iss,
                    settings.CLERK_ISSUER,
                )
            except Exception:
                pass
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No user ID found in token")

        # Clerk doesn't include email in the JWT by default — fetch it if absent.
        if not payload.get("email"):
            payload["email"] = await _fetch_clerk_email(user_id)

        # Normalize to match the shape returned by clerk_session.py so all
        # downstream code can use user.get("id") regardless of auth path.
        payload["id"] = user_id

        return payload

    except PyJWTError as e:
        logger.exception("JWT validation failed: %s", e)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("JWT validation failed: %s", e)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
