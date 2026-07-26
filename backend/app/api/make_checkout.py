"""Outbound trigger to Make when a user starts the checkout / billing flow."""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.config import get_settings
from app.database import get_db
from app.models import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/integrations/make", tags=["make"])


@router.post("/trigger-checkout")
def trigger_checkout(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Authenticated user starts payment.
    POSTs user details to Make (MAKE_TRIGGER_URL) when configured,
    and returns the browser payment URL (GROW_PAYMENT_URL / MAKE_PAYMENT_URL).
    """
    _ = db  # session kept for future audit logging
    settings = get_settings()
    payment_url = (settings.make_payment_url or settings.grow_payment_url or "").strip()
    trigger_url = (settings.make_trigger_url or "").strip()

    payload = {
        "userId": user.id,
        "email": user.email,
        "name": user.full_name,
        "subscription_status": user.subscription_status,
        "thank_you_url": f"{(settings.app_public_url or '').rstrip('/')}/thank-you",
    }

    triggered = False
    trigger_error = None
    if trigger_url:
        try:
            body = json.dumps(payload).encode("utf-8")
            headers = {"Content-Type": "application/json"}
            secret = (
                settings.make_webhook_secret or settings.grow_webhook_secret or ""
            ).strip()
            if secret:
                headers["X-Webhook-Secret"] = secret
            req = urllib.request.Request(
                trigger_url, data=body, headers=headers, method="POST"
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                if 200 <= getattr(resp, "status", 200) < 300:
                    triggered = True
                else:
                    trigger_error = f"Make returned {resp.status}"
        except urllib.error.HTTPError as exc:
            trigger_error = f"Make returned {exc.code}"
            logger.warning("Make trigger failed status=%s", exc.code)
        except Exception as exc:
            trigger_error = str(exc)
            logger.exception("Make trigger request failed")
    else:
        logger.warning("MAKE_TRIGGER_URL not configured — checkout trigger skipped")

    if not payment_url and not triggered:
        raise HTTPException(
            status_code=503,
            detail="Checkout is not configured (missing MAKE_TRIGGER_URL / payment URL)",
        )

    return {
        "ok": True,
        "triggered": triggered,
        "trigger_error": trigger_error,
        "payment_url": payment_url or None,
        "userId": user.id,
    }
