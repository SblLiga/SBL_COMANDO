"""Outbound checkout helpers (DEV bypass + payment URL with user id)."""

from __future__ import annotations

import logging
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.config import get_settings
from app.database import get_db
from app.models import User
from app.subscription import activate_subscription

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/integrations/make", tags=["make"])


def payment_url_for_user(settings, user_id: int) -> str:
    base = (settings.make_payment_url or settings.grow_payment_url or "").strip()
    if not base:
        return ""
    parsed = urlparse(base)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query["custom1"] = str(user_id)
    return urlunparse(parsed._replace(query=urlencode(query)))


@router.post("/trigger-checkout")
def trigger_checkout(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Authenticated user starts payment.

    Non-production: activates subscription (30-day period) so QA can use the app.
    Production: returns Meshulam URL with custom1=userId (site opens it directly;
    Make is notified only after payment via /api/webhooks/payment-success).
    """
    settings = get_settings()

    if not settings.is_production:
        activate_subscription(user)
        db.commit()
        db.refresh(user)
        logger.info("DEV checkout bypass — activated user_id=%s", user.id)
        return {
            "ok": True,
            "bypassed": True,
            "triggered": False,
            "trigger_error": None,
            "payment_url": None,
            "redirect": "/thank-you",
            "userId": user.id,
            "subscription_status": user.subscription_status,
            "subscription_end_date": (
                user.subscription_end_date.isoformat() if user.subscription_end_date else None
            ),
        }

    payment_url = payment_url_for_user(settings, user.id)
    if not payment_url:
        raise HTTPException(
            status_code=503,
            detail="Checkout is not configured (missing GROW_PAYMENT_URL)",
        )

    return {
        "ok": True,
        "bypassed": False,
        "triggered": False,
        "trigger_error": None,
        "payment_url": payment_url,
        "userId": user.id,
    }


@router.post("/dev-activate")
def dev_activate_subscription(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Explicit DEV-only activator for accounts already stuck on inactive."""
    settings = get_settings()
    if settings.is_production:
        raise HTTPException(status_code=404, detail="Not found")
    activate_subscription(user)
    db.commit()
    db.refresh(user)
    return {
        "ok": True,
        "subscription_status": user.subscription_status,
        "subscription_end_date": (
            user.subscription_end_date.isoformat() if user.subscription_end_date else None
        ),
        "redirect": "/thank-you",
        "userId": user.id,
    }
