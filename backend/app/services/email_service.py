import requests
from typing import Optional, Dict, Any

from app.config import settings


def send_email_mailgun(
    to: str,
    subject: str,
    html: str,
    from_email: Optional[str] = None,
) -> bool:
    if not settings.MAILGUN_API_KEY:
        print(f"[EMAIL] Mailgun not configured. Would send to {to}: {subject}")
        return False

    from_addr = from_email or f"GuidesForge <noreply@{settings.MAILGUN_DOMAIN}>"
    try:
        response = requests.post(
            f"https://api.mailgun.net/v3/{settings.MAILGUN_DOMAIN}/messages",
            auth=("api", settings.MAILGUN_API_KEY),
            data={
                "from": from_addr,
                "to": [to],
                "subject": subject,
                "html": html,
            },
        )
        return response.status_code == 200
    except Exception as e:
        print(f"[EMAIL] Error sending email: {e}")
        return False


def send_staleness_notification(
    to: str,
    guide_title: str,
    diff_percentage: float,
    guide_id: str,
    workspace_slug: str,
) -> bool:
    html = f"""
    <div style="font-family: 'Satoshi', sans-serif; max-width: 600px; margin: 0 auto; background: #0C0D14; color: #FFFFFF; padding: 40px; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #6366F1; margin: 0;">GuidesForge</h1>
        </div>
        <h2 style="color: #F97316; margin-bottom: 16px;">⚠️ Guide Needs Update</h2>
        <p style="color: #94A3B8; line-height: 1.6;">
            Your guide <strong style="color: #FFFFFF;">"{guide_title}"</strong> has been flagged as
            <span style="color: #EF4444; font-weight: 600;">stale</span>.
        </p>
        <div style="background: #1A1B23; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px; margin: 24px 0;">
            <p style="color: #94A3B8; margin: 0 0 8px 0;">UI Change Detected</p>
            <p style="color: #EF4444; font-size: 28px; font-weight: 700; margin: 0;">{diff_percentage:.1f}% different</p>
        </div>
        <p style="color: #94A3B8; line-height: 1.6;">
            The UI in one or more steps has changed significantly since the guide was created.
            Re-record or update the affected steps to keep your documentation accurate.
        </p>
        <div style="text-align: center; margin-top: 32px;">
            <a href="{settings.FRONTEND_URL}/guides/{guide_id}/edit"
               style="background: #6366F1; color: white; padding: 12px 32px; border-radius: 9999px; text-decoration: none; font-weight: 600;">
                Review & Update Guide
            </a>
        </div>
    </div>
    """
    return send_email_mailgun(to, f"[GuidesForge] Guide needs update: {guide_title}", html)


def send_invitation_email(
    to: str,
    workspace_name: str,
    inviter_name: str,
    invite_link: str,
) -> bool:
    html = f"""
    <div style="font-family: 'Satoshi', sans-serif; max-width: 600px; margin: 0 auto; background: #0C0D14; color: #FFFFFF; padding: 40px; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #6366F1; margin: 0;">GuidesForge</h1>
        </div>
        <h2 style="color: #FFFFFF;">You've been invited!</h2>
        <p style="color: #94A3B8; line-height: 1.6;">
            <strong style="color: #FFFFFF;">{inviter_name}</strong> has invited you to join the
            <strong style="color: #FFFFFF;">"{workspace_name}"</strong> workspace on GuidesForge.
        </p>
        <div style="text-align: center; margin-top: 32px;">
            <a href="{invite_link}"
               style="background: #6366F1; color: white; padding: 12px 32px; border-radius: 9999px; text-decoration: none; font-weight: 600;">
                Accept Invitation
            </a>
        </div>
    </div>
    """
    return send_email_mailgun(to, f"[GuidesForge] You're invited to {workspace_name}", html)


def send_welcome_email(to: str, full_name: str) -> bool:
    html = f"""
    <div style="font-family: 'Satoshi', sans-serif; max-width: 600px; margin: 0 auto; background: #0C0D14; color: #FFFFFF; padding: 40px; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #6366F1; margin: 0;">GuidesForge</h1>
        </div>
        <h2 style="color: #FFFFFF;">Welcome to GuidesForge, {full_name or 'there'}! 🎉</h2>
        <p style="color: #94A3B8; line-height: 1.6;">
            You're on a <strong style="color: #A78BFA;">14-day Pro trial</strong>. Here's what you can do:
        </p>
        <ul style="color: #94A3B8; line-height: 2;">
            <li>Install the Chrome extension to start recording guides</li>
            <li>AI automatically narrates, annotates, and assembles your guides</li>
            <li>Publish to your help center and embed anywhere</li>
            <li>Get staleness alerts when your UI changes</li>
        </ul>
        <div style="text-align: center; margin-top: 32px;">
            <a href="{settings.FRONTEND_URL}/dashboard"
               style="background: #6366F1; color: white; padding: 12px 32px; border-radius: 9999px; text-decoration: none; font-weight: 600;">
                Go to Dashboard
            </a>
        </div>
    </div>
    """
    return send_email_mailgun(to, "Welcome to GuidesForge — Your 14-day Pro trial is active", html)
