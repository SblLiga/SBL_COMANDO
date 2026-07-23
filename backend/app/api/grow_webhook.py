"""GROW payment webhook scaffold — wire real payload mapping tomorrow morning."""

from __future__ import annotations

import hashlib
import hmac
import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import User
from sqlalchemy import select

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/integrations/grow", tags=["grow"])


def _verify_signature(raw_body: bytes, signature: str | None, secret: str) -> bool:
    if not secret:
        # DEV without secret: accept but log loudly
        logger.warning("GROW_WEBHOOK_SECRET empty — signature check skipped (DEV only)")
        return True
    if not signature:
        return False
    digest = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    # Accept either raw hex or "sha256=<hex>"
    provided = signature.removeprefix("sha256=")
    return hmac.compare_digest(digest, provided)


@router.get("/health")
def grow_health():
    settings = get_settings()
    return {
        "ok": True,
        "webhook_path": "/api/integrations/grow/webhook",
        "secret_configured": bool(settings.grow_webhook_secret),
        "payment_url": settings.grow_payment_url or None,
    }


@router.post("/webhook")
async def grow_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_grow_signature: str | None = Header(default=None, alias="X-Grow-Signature"),
):
    """
    Expected tomorrow (adjust to GROW docs):
    - Verify HMAC with GROW_WEBHOOK_SECRET
    - Resolve user by email / external_customer_id
    - Map event → User.subscription_status = active | inactive
    """
    settings = get_settings()
    raw = await request.body()
    if not _verify_signature(raw, x_grow_signature, settings.grow_webhook_secret):
        raise HTTPException(status_code=401, detail="Invalid GROW signature")

    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON") from None

    event = (payload.get("event") or payload.get("type") or "").lower()
    email = (payload.get("email") or payload.get("customer_email") or "").strip().lower()
    status_raw = (payload.get("subscription_status") or payload.get("status") or "").lower()

    logger.info("GROW webhook received event=%s email=%s keys=%s", event, email, list(payload.keys()))

    if not email:
        # Ack without mutation — GROW may send events without email
        return {"received": True, "updated": False, "reason": "no_email"}

    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        return {"received": True, "updated": False, "reason": "user_not_found"}

    # Heuristic mapping — refine against GROW event catalog tomorrow
    activate_events = {"payment.success", "subscription.active", "subscription.renewed", "charge.succeeded"}
    deactivate_events = {"payment.failed", "subscription.cancelled", "subscription.expired", "charge.failed"}

    new_status = None
    if event in activate_events or status_raw in {"active", "paid", "success"}:
        new_status = "active"
    elif event in deactivate_events or status_raw in {"inactive", "cancelled", "expired", "failed"}:
        new_status = "inactive"

    if new_status is None:
        return {"received": True, "updated": False, "reason": "unmapped_event", "event": event}

    user.subscription_status = new_status
    db.commit()
    logger.info("GROW updated user=%s subscription_status=%s", email, new_status)
    return {"received": True, "updated": True, "email": email, "subscription_status": new_status}
