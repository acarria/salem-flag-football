import resend
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
    <p>Hi {to_name},</p>
    <p><strong>{inviter_name}</strong> has invited you to join their group
    <strong>{group_name}</strong> for the <strong>{league_name}</strong> league.</p>
    <p>Click the link below to accept or decline your invitation:</p>
    <p><a href="{invite_url}" style="background:#22c55e;color:#fff;padding:12px 24px;
    border-radius:6px;text-decoration:none;font-weight:bold;">View Invitation</a></p>
    <p>This invitation expires in 7 days.</p>
    <p>If you did not expect this invitation you can safely ignore this email.</p>
    """
    resend.Emails.send({
        "from": settings.EMAIL_FROM,
        "to": to_email,
        "subject": f"You're invited to join {group_name} – {league_name}",
        "html": html,
    })
