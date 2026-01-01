import httpx
import jwt
from fastapi import Depends, HTTPException, status, Request
from app.core.config import settings

async def get_current_user_from_session(request: Request):
    """Validate Clerk session token and return user info"""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing or invalid Authorization header")
    
    token = auth_header.split(" ", 1)[1]
    
    try:
        # First, try to decode the JWT to get the session ID
        try:
            # Decode the JWT without verification to get the payload
            decoded = jwt.decode(token, options={"verify_signature": False})
            
            # Extract session ID from the JWT
            session_id = decoded.get("sid")
            if not session_id:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No session ID found in token")
            
        except jwt.InvalidTokenError:
            # If it's not a JWT, treat it as a direct session token
            session_id = token
        
        # Verify the session with Clerk's API
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://api.clerk.com/v1/sessions/{session_id}",
                headers={
                    "Authorization": f"Bearer {settings.CLERK_SECRET_KEY}",
                    "Content-Type": "application/json"
                }
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session token")
            session_data = response.json()
            user_id = session_data.get("user_id")
            if not user_id:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No user found in session")

            user_response = await client.get(
                f"https://api.clerk.com/v1/users/{user_id}",
                headers={
                    "Authorization": f"Bearer {settings.CLERK_SECRET_KEY}",
                    "Content-Type": "application/json"
                }
            )
            if user_response.status_code != 200:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Failed to get user details")
            user_data = user_response.json()
            email_addresses = user_data.get("email_addresses", [])
            email = email_addresses[0].get("email_address") if email_addresses else None
            if not email:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No email found for user")
            return {
                "id": user_id,
                "email": email,
                "email_addresses": [{"email_address": email}]
            }
    except httpx.RequestError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Failed to verify session: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Authentication error: {str(e)}") 