import base64
import logging
from datetime import datetime
from pathlib import Path

import resend
from jinja2 import Environment, FileSystemLoader, select_autoescape
from app.core.config import settings

logger = logging.getLogger(__name__)

# TODO: Replace fire-and-forget email sends with an SQS queue + DLQ for
# reliable delivery. Critical emails like waiver prompts directly affect
# registration lifecycle — a silent failure means the player's registration
# may expire without notification. See REVIEW_REPORT.md item 6.

# Set API key once at module load, not on every call
if settings.RESEND_API_KEY:
    resend.api_key = settings.RESEND_API_KEY

# Jinja2 environment with auto-escaping for HTML email templates
_TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates" / "email"
_jinja_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATE_DIR)),
    autoescape=select_autoescape(["html"]),
)


def send_group_invitation(
    to_email: str,
    to_name: str,
    inviter_name: str,
    group_name: str,
    league_name: str,
    token: str,
    app_url: str,
    expiry_days: int = 7,
):
    invite_url = f"{app_url}/invite/{token}"
    expiry_label = f"{expiry_days} day{'s' if expiry_days != 1 else ''}"
    html = _jinja_env.get_template("group_invitation.html").render(
        to_name=to_name,
        inviter_name=inviter_name,
        group_name=group_name,
        league_name=league_name,
        invite_url=invite_url,
        expiry_label=expiry_label,
    )
    resend.Emails.send({
        "from": settings.EMAIL_FROM,
        "to": to_email,
        "subject": f"You're invited to join {group_name} \u2013 {league_name}",
        "html": html,
    })
    logger.info("Email sent: type=group_invitation to=%s", to_email)


def send_contact_message(
    sender_name: str,
    sender_email: str,
    subject: str,
    message: str,
):
    from markupsafe import Markup, escape
    message_html = escape(message).replace("\n", Markup("<br />"))
    html = _jinja_env.get_template("contact_message.html").render(
        sender_name=sender_name,
        sender_email=sender_email,
        subject=subject,
        message_html=message_html,
    )
    resend.Emails.send({
        "from": settings.EMAIL_FROM,
        "to": settings.CONTACT_EMAIL,
        "subject": f"[Contact] {subject}",
        "html": html,
    })
    logger.info("Email sent: type=contact_message from=%s", sender_email)


def send_waiver_prompt(
    to_email: str,
    to_name: str,
    league_name: str,
    league_id: str,
    expiry_days: int,
):
    """Send an email prompting the player to sign their waiver after registration."""
    waiver_url = f"{settings.APP_URL}/waiver/{league_id}"
    expiry_label = f"{expiry_days} day{'s' if expiry_days != 1 else ''}"
    html = _jinja_env.get_template("waiver_prompt.html").render(
        to_name=to_name,
        league_name=league_name,
        waiver_url=waiver_url,
        expiry_label=expiry_label,
    )
    resend.Emails.send({
        "from": settings.EMAIL_FROM,
        "to": to_email,
        "subject": f"Action Required: Sign Your Waiver \u2014 {league_name}",
        "html": html,
    })
    logger.info("Email sent: type=waiver_prompt to=%s", to_email)


def send_waiver_confirmation(
    to_email: str,
    to_name: str,
    league_name: str,
    waiver_version: str,
    signed_at: datetime,
    pdf_bytes: bytes,
):
    signed_at_str = signed_at.strftime("%B %d, %Y at %I:%M %p UTC")
    html = _jinja_env.get_template("waiver_confirmation.html").render(
        to_name=to_name,
        league_name=league_name,
        signed_at_str=signed_at_str,
        waiver_version=waiver_version,
    )
    resend.Emails.send({
        "from": settings.EMAIL_FROM,
        "to": to_email,
        "subject": f"Waiver Signed \u2014 {league_name}",
        "html": html,
        "attachments": [
            {
                "filename": "signed-waiver.pdf",
                "content": base64.b64encode(pdf_bytes).decode(),
            }
        ],
    })
    logger.info("Email sent: type=waiver_confirmation to=%s", to_email)
