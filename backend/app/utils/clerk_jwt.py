import asyncio
import httpx
import logging
from jose import jwt, JWTError
from fastapi import HTTPException, status, Request
from app.core.config import settings
import time

logger = logging.getLogger(__name__)

JWKS_CACHE = {"keys": None, "fetched_at": 0}
JWKS_CACHE_TTL = 60 * 60  # 1 hour
_JWKS_LOCK = asyncio.Lock()

# Normalize issuer: strip trailing slash so both "…dev" and "…dev/" validate.
_CLERK_ISSUER_NORMALIZED = settings.CLERK_ISSUER.rstrip("/")

async def get_jwks():
    now = int(time.time())
    if JWKS_CACHE["keys"] and now - JWKS_CACHE["fetched_at"] < JWKS_CACHE_TTL:
        return JWKS_CACHE["keys"]
    async with _JWKS_LOCK:
        # Re-check after acquiring lock (another coroutine may have refreshed)
        if JWKS_CACHE["keys"] and now - JWKS_CACHE["fetched_at"] < JWKS_CACHE_TTL:
            return JWKS_CACHE["keys"]
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(settings.CLERK_JWKS_URL)
            resp.raise_for_status()
            JWKS_CACHE["keys"] = resp.json()
            JWKS_CACHE["fetched_at"] = int(time.time())
            return JWKS_CACHE["keys"]

async def _fetch_clerk_email(user_id: str) -> str:
    """Fetch primary email for a Clerk user via the backend API."""
    url = f"https://api.clerk.com/v1/users/{user_id}"
    headers = {"Authorization": f"Bearer {settings.CLERK_SECRET_KEY}"}
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            data = resp.json()
    except httpx.TimeoutException:
        logger.error("Clerk API timed out fetching email for user %s", user_id)
        raise HTTPException(status_code=503, detail="Authentication service unavailable. Please retry.")
    except httpx.HTTPStatusError as e:
        logger.error("Clerk API error fetching email for user %s: %s", user_id, e.response.status_code)
        raise HTTPException(status_code=401, detail="Unable to verify user identity.")
    addresses = data.get("email_addresses", [])
    primary_id = data.get("primary_email_address_id")
    for addr in addresses:
        if addr.get("id") == primary_id:
            return addr["email_address"]
    if addresses:
        return addresses[0]["email_address"]
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No email found for user")

async def get_optional_user(request: Request):
    """Like get_current_user but returns None instead of raising for missing/invalid tokens.
    Safe to use on public endpoints that optionally personalise their response.
    Does NOT call _fetch_clerk_email — user_id only."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ", 1)[1]
    try:
        jwks = await get_jwks()
        payload = jwt.decode(
            token,
            jwks,
            algorithms=["RS256"],
            options={"verify_aud": False},
            issuer=_CLERK_ISSUER_NORMALIZED,
        )
        user_id = payload.get("sub")
        if not user_id:
            return None
        return {"id": user_id}
    except Exception:
        return None


async def get_current_user(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing or invalid Authorization header")

    token = auth_header.split(" ", 1)[1]

    try:
        # Log issuer for diagnostics before full validation
        unverified = jwt.get_unverified_claims(token)
        token_iss = str(unverified.get("iss", ""))[:200]
        if token_iss.rstrip("/") != _CLERK_ISSUER_NORMALIZED:
            logger.error(
                "Issuer mismatch — token iss=%r, configured CLERK_ISSUER=%r",
                token_iss,
                settings.CLERK_ISSUER,
            )

        jwks = await get_jwks()
        payload = jwt.decode(
            token,
            jwks,
            algorithms=["RS256"],
            options={"verify_aud": False},
            issuer=_CLERK_ISSUER_NORMALIZED,
        )

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

    except JWTError as e:
        logger.exception("JWT validation failed: %s", e)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("JWT validation failed: %s", e)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token") 