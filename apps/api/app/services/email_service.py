import base64
import logging
from datetime import datetime

import resend
from html import escape
from app.core.config import settings

logger = logging.getLogger(__name__)

# Set API key once at module load, not on every call
if settings.RESEND_API_KEY:
    resend.api_key = settings.RESEND_API_KEY


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
    html = f"""
    <h2>You've been invited to join a flag football group!</h2>
    <p>Hi {escape(to_name)},</p>
    <p><strong>{escape(inviter_name)}</strong> has invited you to join their group
    <strong>{escape(group_name)}</strong> for the <strong>{escape(league_name)}</strong> league.</p>
    <p>Click the link below to accept or decline your invitation:</p>
    <p><a href="{invite_url}" style="background:#22c55e;color:#fff;padding:12px 24px;
    border-radius:6px;text-decoration:none;font-weight:bold;">View Invitation</a></p>
    <p>This invitation expires in {expiry_label}.</p>
    <p>If you did not expect this invitation you can safely ignore this email.</p>
    """
    resend.Emails.send({
        "from": settings.EMAIL_FROM,
        "to": to_email,
        "subject": f"You're invited to join {escape(group_name)} – {escape(league_name)}",
        "html": html,
    })


def send_contact_message(
    sender_name: str,
    sender_email: str,
    subject: str,
    message: str,
):
    html = f"""
    <h2>New Contact Form Submission</h2>
    <p><strong>From:</strong> {escape(sender_name)} &lt;{escape(sender_email)}&gt;</p>
    <p><strong>Subject:</strong> {escape(subject)}</p>
    <hr />
    <p>{escape(message).replace(chr(10), '<br />')}</p>
    """
    resend.Emails.send({
        "from": settings.EMAIL_FROM,
        "to": settings.CONTACT_EMAIL,
        "subject": f"[Contact] {escape(subject)}",
        "html": html,
    })


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
    html = f"""
    <h2>Welcome to {escape(league_name)}!</h2>
    <p>Hi {escape(to_name)},</p>
    <p>You have successfully registered for <strong>{escape(league_name)}</strong>.
    To complete your registration, you need to sign the liability waiver.</p>
    <p>You have <strong>{expiry_label}</strong> to sign the waiver. If you do not sign within
    this period, your registration will expire and your spot will be released.</p>
    <p><a href="{waiver_url}" style="background:#22c55e;color:#fff;padding:12px 24px;
    border-radius:6px;text-decoration:none;font-weight:bold;">Sign Waiver Now</a></p>
    <p style="color:#666;font-size:13px;">If you already signed the waiver during registration,
    you can ignore this email.</p>
    """
    resend.Emails.send({
        "from": settings.EMAIL_FROM,
        "to": to_email,
        "subject": f"Action Required: Sign Your Waiver — {escape(league_name)}",
        "html": html,
    })


def send_waiver_confirmation(
    to_email: str,
    to_name: str,
    league_name: str,
    waiver_version: str,
    signed_at: datetime,
    pdf_bytes: bytes,
):
    signed_at_str = signed_at.strftime("%B %d, %Y at %I:%M %p UTC")
    html = f"""
    <h2>Waiver Signed Successfully</h2>
    <p>Hi {escape(to_name)},</p>
    <p>This confirms that you have signed the liability waiver for
    <strong>{escape(league_name)}</strong>.</p>
    <p><strong>Date signed:</strong> {signed_at_str}</p>
    <p><strong>Waiver version:</strong> {escape(waiver_version)}</p>
    <p>A PDF copy of your signed waiver is attached to this email for your records.</p>
    <p>This document was signed electronically in accordance with the ESIGN Act.</p>
    """
    resend.Emails.send({
        "from": settings.EMAIL_FROM,
        "to": to_email,
        "subject": f"Waiver Signed — {escape(league_name)}",
        "html": html,
        "attachments": [
            {
                "filename": "signed-waiver.pdf",
                "content": base64.b64encode(pdf_bytes).decode(),
            }
        ],
    })
