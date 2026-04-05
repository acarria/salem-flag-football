import asyncio
import functools
import logging

from fastapi import APIRouter, HTTPException, Request

from app.api.schemas.common import SuccessResponse
from app.api.schemas.contact import ContactRequest
from app.core.config import settings
from app.core.limiter import limiter
from app.services.email_service import send_contact_message
from app.utils.recaptcha import verify_recaptcha

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("", response_model=SuccessResponse)
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
    except Exception as e:
        logger.exception("Failed to send contact email: %s", e)
        raise HTTPException(status_code=500, detail="Failed to send message. Please try again later.")

    return SuccessResponse(success=True, message="Your message has been sent.")
