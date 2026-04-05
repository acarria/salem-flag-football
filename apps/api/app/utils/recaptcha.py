import logging

import httpx
from fastapi import HTTPException

from app.core.config import settings

logger = logging.getLogger(__name__)


async def verify_recaptcha(token: str) -> bool:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                "https://www.google.com/recaptcha/api/siteverify",
                data={
                    "secret": settings.RECAPTCHA_SECRET_KEY,
                    "response": token,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("success", False) and data.get("score", 0.0) >= 0.5
    except httpx.TimeoutException:
        logger.error("reCAPTCHA verification timed out")
        raise HTTPException(status_code=503, detail="Service temporarily unavailable.")
    except Exception as e:
        logger.error("reCAPTCHA verification failed: %s", e)
        raise HTTPException(status_code=400, detail="Could not verify reCAPTCHA.")
