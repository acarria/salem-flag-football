import resend
from html import escape
from app.core.config import settings


def send_group_invitation(
    to_email: str,
    to_name: str,
    inviter_name: str,
    group_name: str,
    league_name: str,
    token: str,
    app_url: str,
):
    resend.api_key = settings.RESEND_API_KEY
    invite_url = f"{app_url}/invite/{token}"
    html = f"""
    <h2>You've been invited to join a flag football group!</h2>
    <p>Hi {escape(to_name)},</p>
    <p><strong>{escape(inviter_name)}</strong> has invited you to join their group
    <strong>{escape(group_name)}</strong> for the <strong>{escape(league_name)}</strong> league.</p>
    <p>Click the link below to accept or decline your invitation:</p>
    <p><a href="{invite_url}" style="background:#22c55e;color:#fff;padding:12px 24px;
    border-radius:6px;text-decoration:none;font-weight:bold;">View Invitation</a></p>
    <p>This invitation expires in 7 days.</p>
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
    resend.api_key = settings.RESEND_API_KEY
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
