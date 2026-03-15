import html
import httpx
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, EmailStr, field_validator
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings
from app.services.email_service import send_contact_message

router = APIRouter()

limiter = Limiter(
    key_func=lambda r: r.headers.get("X-Forwarded-For", r.client.host or "unknown").split(",")[0].strip()
)


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
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://www.google.com/recaptcha/api/siteverify",
            data={
                "secret": settings.RECAPTCHA_SECRET_KEY,
                "response": token,
            },
        )
        data = resp.json()
        return data.get("success", False)


@router.post("")
@limiter.limit("5/hour")
async def contact(request: Request, body: ContactRequest):
    if settings.RECAPTCHA_SECRET_KEY:
        valid = await verify_recaptcha(body.recaptcha_token)
        if not valid:
            raise HTTPException(status_code=400, detail="reCAPTCHA verification failed")

    if not settings.CONTACT_EMAIL:
        raise HTTPException(status_code=500, detail="Contact email not configured")

    try:
        send_contact_message(
            sender_name=body.name,
            sender_email=body.email,
            subject=body.subject,
            message=body.message,
        )
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to send message. Please try again later.")

    return {"success": True, "message": "Your message has been sent."}
