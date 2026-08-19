"""GROW payment webhook — maps Grow events onto User.subscription_status."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy.orm import Session

from app.api.subscription_webhooks import (
    _read_verified_payload,
    apply_subscription_status,
    apply_successful_payment,
    is_grow_failed_recurring,
    resolve_user,
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
        "payment_failed_path": "/api/webhooks/payment-failed",
        "subscription_cancelled_path": "/api/webhooks/subscription-cancelled",
        "secret_configured": bool(webhook_secret()),
        "auth": "grow_ip_or_webhookKey_or_shared_secret",
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
    Prefer dedicated routes:
      POST /api/webhooks/payment-success
      POST /api/webhooks/payment-failed
      POST /api/webhooks/subscription-cancelled
    """
    payload = await _read_verified_payload(
        request,
        x_make_signature=x_make_signature,
        x_grow_signature=x_grow_signature,
        x_webhook_secret=x_webhook_secret,
        authorization=authorization,
    )

    event = (payload.get("event") or payload.get("type") or "").lower()
    status_raw = (payload.get("subscription_status") or payload.get("status") or "").lower()

    logger.info(
        "GROW webhook received event=%s keys=%s",
        event,
        list(payload.keys()),
    )

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
    if is_grow_failed_recurring(payload) or event in deactivate_events or status_raw in {
        "inactive",
        "cancelled",
        "expired",
        "failed",
    }:
        new_status = "inactive"
    elif event in activate_events or status_raw in {"active", "paid", "success", "1", "שולם"}:
        new_status = "active"
    elif payload.get("payerEmail") or payload.get("transactionCode") or payload.get("directDebitId"):
        # Official Grow success payloads often omit event/type.
        new_status = "active"

    if new_status is None:
        return {"received": True, "updated": False, "reason": "unmapped_event", "event": event}

    if new_status == "active":
        return apply_successful_payment(db, payload, user)

    result = apply_subscription_status(db, user, new_status)
    result["error_message"] = payload.get("error_message")
    result["regular_payment_id"] = payload.get("regular_payment_id")
    return result
