import httpx
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status, Request
from functools import lru_cache
from app.core.config import settings
import time

JWKS_CACHE = {"keys": None, "fetched_at": 0}
JWKS_CACHE_TTL = 60 * 60  # 1 hour

async def get_jwks():
    now = int(time.time())
    if JWKS_CACHE["keys"] and now - JWKS_CACHE["fetched_at"] < JWKS_CACHE_TTL:
        return JWKS_CACHE["keys"]
    async with httpx.AsyncClient() as client:
        resp = await client.get(settings.CLERK_JWKS_URL)
        resp.raise_for_status()
        JWKS_CACHE["keys"] = resp.json()
        JWKS_CACHE["fetched_at"] = now
        return JWKS_CACHE["keys"]

async def get_current_user(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing or invalid Authorization header")
    token = auth_header.split(" ", 1)[1]
    jwks = await get_jwks()
    try:
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header["kid"]
        key = next((k for k in jwks["keys"] if k["kid"] == kid), None)
        if not key:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token signature")
        payload = jwt.decode(
            token,
            key,
            algorithms=key["alg"],
            audience=None,  # Clerk tokens are audience-less by default
            issuer=settings.CLERK_ISSUER,
            options={"verify_aud": False}
        )
        return payload  # Contains sub, email, etc.
    except JWTError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"JWT validation error: {str(e)}") 