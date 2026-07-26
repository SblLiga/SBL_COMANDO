"""GROW payment webhook — maps Grow events onto User.subscription_status."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from app.api.subscription_webhooks import (
    apply_subscription_status,
    resolve_user,
    verify_webhook_auth,
    webhook_secret,
)
from app.config import get_settings
from app.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/integrations/grow", tags=["grow"])


@router.get("/health")
def grow_health():
    settings = get_settings()
    return {
        "ok": True,
        "webhook_path": "/api/integrations/grow/webhook",
        "payment_success_path": "/api/webhooks/payment-success",
        "subscription_cancelled_path": "/api/webhooks/subscription-cancelled",
        "secret_configured": bool(webhook_secret()),
        "payment_url": settings.grow_payment_url or settings.make_payment_url or None,
        "make_trigger_configured": bool(settings.make_trigger_url),
    }


@router.post("/webhook")
async def grow_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_grow_signature: str | None = Header(default=None, alias="X-Grow-Signature"),
    x_make_signature: str | None = Header(default=None, alias="X-Make-Signature"),
    x_webhook_secret: str | None = Header(default=None, alias="X-Webhook-Secret"),
    authorization: str | None = Header(default=None),
):
    """
    Legacy / Grow-compatible webhook.
    Prefer dedicated Make routes:
      POST /api/webhooks/payment-success
      POST /api/webhooks/subscription-cancelled
    """
    import json

    raw = await request.body()
    if not verify_webhook_auth(
        raw,
        signature=x_grow_signature or x_make_signature,
        bearer=authorization,
        plain_secret_header=x_webhook_secret,
    ):
        raise HTTPException(status_code=401, detail="Invalid GROW signature")

    try:
        payload = json.loads(raw.decode("utf-8") or "{}")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON") from None

    event = (payload.get("event") or payload.get("type") or "").lower()
    status_raw = (payload.get("subscription_status") or payload.get("status") or "").lower()

    logger.info(
        "GROW webhook received event=%s keys=%s",
        event,
        list(payload.keys()) if isinstance(payload, dict) else type(payload),
    )

    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Payload must be a JSON object")

    user = resolve_user(db, payload)
    if user is None:
        return {"received": True, "updated": False, "reason": "user_not_found"}

    activate_events = {
        "payment.success",
        "subscription.active",
        "subscription.renewed",
        "charge.succeeded",
    }
    deactivate_events = {
        "payment.failed",
        "subscription.cancelled",
        "subscription.expired",
        "charge.failed",
    }

    new_status = None
    if event in activate_events or status_raw in {"active", "paid", "success"}:
        new_status = "active"
    elif event in deactivate_events or status_raw in {
        "inactive",
        "cancelled",
        "expired",
        "failed",
    }:
        new_status = "inactive"

    if new_status is None:
        return {"received": True, "updated": False, "reason": "unmapped_event", "event": event}

    result = apply_subscription_status(db, user, new_status)
    if new_status == "active":
        result["redirect"] = "/thank-you"
    return result
