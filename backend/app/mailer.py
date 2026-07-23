"""Transactional email via Amazon SES (optional). Falls back to logging in DEV."""

from __future__ import annotations

import logging
import os

from app.config import Settings

logger = logging.getLogger(__name__)


def _ses_client(region: str):
    import boto3

    return boto3.client("ses", region_name=region)


def send_email(settings: Settings, *, to: str, subject: str, body_text: str) -> bool:
    """
    Send email through SES when MAIL_FROM is configured.
    Returns True if SES accepted the message, False if skipped/failed.
    """
    mail_from = (settings.mail_from or "").strip()
    if not mail_from:
        logger.warning("MAIL_FROM not set — email to %s was NOT sent. Subject: %s", to, subject)
        logger.info("EMAIL_FALLBACK to=%s subject=%s body=%s", to, subject, body_text)
        return False

    region = (
        settings.aws_region
        or os.environ.get("AWS_REGION")
        or os.environ.get("AWS_DEFAULT_REGION")
        or "us-east-1"
    )
    try:
        client = _ses_client(region)
        client.send_email(
            Source=mail_from,
            Destination={"ToAddresses": [to]},
            Message={
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body": {"Text": {"Data": body_text, "Charset": "UTF-8"}},
            },
        )
        logger.info("Email sent via SES to %s (%s)", to, subject)
        return True
    except Exception:
        logger.exception("SES send failed for %s — subject=%s", to, subject)
        logger.info("EMAIL_FALLBACK to=%s subject=%s body=%s", to, subject, body_text)
        return False


def send_otp_email(settings: Settings, *, to: str, code: str) -> bool:
    return send_email(
        settings,
        to=to,
        subject="קוד אימות — שולי בן לולו",
        body_text=(
            f"שלום,\n\n"
            f"קוד האימות שלך הוא: {code}\n"
            f"הקוד תקף ל-15 דקות.\n\n"
            f"אם לא ביקשת להירשם — התעלמ/י מהודעה זו.\n"
            f"— ליגת כובשים יעדים | שולי בן לולו\n"
        ),
    )


def send_password_reset_email(settings: Settings, *, to: str, reset_url: str) -> bool:
    return send_email(
        settings,
        to=to,
        subject="איפוס סיסמה — שולי בן לולו",
        body_text=(
            f"שלום,\n\n"
            f"לאיפוס הסיסמה לחצ/י על הקישור:\n{reset_url}\n\n"
            f"הקישור תקף לשעה אחת.\n"
            f"אם לא ביקשת איפוס — התעלמ/י מהודעה זו.\n"
        ),
    )
