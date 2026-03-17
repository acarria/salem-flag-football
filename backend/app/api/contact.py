import asyncio
import functools
import html
import logging
import httpx
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, EmailStr, field_validator
from app.core.config import settings
from app.core.limiter import limiter
from app.services.email_service import send_contact_message

logger = logging.getLogger(__name__)

router = APIRouter()


class ContactRequest(BaseModel):
    name: str
    email: EmailStr
    subject: str
    message: str
    recaptcha_token: str

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name is required")
        if len(v) > 100:
            raise ValueError("Name must be 100 characters or fewer")
        return html.escape(v)

    @field_validator("subject")
    @classmethod
    def validate_subject(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Subject is required")
        if len(v) > 200:
            raise ValueError("Subject must be 200 characters or fewer")
        return html.escape(v)

    @field_validator("message")
    @classmethod
    def validate_message(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Message is required")
        if len(v) > 2000:
            raise ValueError("Message must be 2000 characters or fewer")
        return html.escape(v)


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
            return data.get("success", False) and data.get("score", 1.0) >= 0.5
    except httpx.TimeoutException:
        logger.error("reCAPTCHA verification timed out")
        raise HTTPException(status_code=503, detail="Service temporarily unavailable.")
    except Exception as e:
        logger.error("reCAPTCHA verification failed: %s", e)
        raise HTTPException(status_code=400, detail="Could not verify reCAPTCHA.")


@router.post("")
@limiter.limit("5/hour")
async def contact(request: Request, body: ContactRequest):
    if not settings.RECAPTCHA_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Contact form is temporarily unavailable.")
    valid = await verify_recaptcha(body.recaptcha_token)
    if not valid:
        raise HTTPException(status_code=400, detail="reCAPTCHA verification failed")

    if not settings.CONTACT_EMAIL:
        raise HTTPException(status_code=500, detail="Contact email not configured")

    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(
            None,
            functools.partial(
                send_contact_message,
                sender_name=body.name,
                sender_email=body.email,
                subject=body.subject,
                message=body.message,
            ),
        )
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to send message. Please try again later.")

    return {"success": True, "message": "Your message has been sent."}
