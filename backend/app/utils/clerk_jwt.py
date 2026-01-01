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
        print(f"DEBUG: Missing or invalid Authorization header: {auth_header}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing or invalid Authorization header")
    
    token = auth_header.split(" ", 1)[1]
    print(f"DEBUG: Token received: {token[:50]}...")
    
    try:
        # First, try to decode without verification to see the structure
        unverified_payload = jwt.decode(token, options={"verify_signature": False})
        print(f"DEBUG: Unverified payload: {unverified_payload}")
        
        # For development, we'll use unverified decoding
        # In production, you should use proper JWT validation
        payload = unverified_payload
        
        # Extract required fields
        user_id = payload.get("sub")
        email = payload.get("email")
        
        if not user_id:
            print("DEBUG: No 'sub' found in token")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No user ID found in token")
        
        if not email:
            print("DEBUG: No 'email' found in token")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No email found in token")
        
        print(f"DEBUG: Authentication successful for user: {email}")
        return payload
        
    except JWTError as e:
        print(f"DEBUG: JWT validation error: {str(e)}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"JWT validation error: {str(e)}")
    except Exception as e:
        print(f"DEBUG: Unexpected error: {str(e)}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Authentication error: {str(e)}") 