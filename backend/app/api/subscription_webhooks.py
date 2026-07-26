"""Make / payment webhooks — activate or deactivate user subscription_status."""

from __future__ import annotations

import hashlib
import hmac
import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


def webhook_secret() -> str:
    settings = get_settings()
    return (settings.make_webhook_secret or settings.grow_webhook_secret or "").strip()


def verify_webhook_auth(
    raw_body: bytes,
    *,
    signature: str | None,
    bearer: str | None,
    plain_secret_header: str | None,
) -> bool:
    """Accept HMAC signature, Bearer token, or plain X-Webhook-Secret header."""
    settings = get_settings()
    secret = webhook_secret()
    if not secret:
        if settings.is_production:
            logger.error("Webhook secret missing in production — rejecting")
            return False
        logger.warning("Webhook secret empty — signature check skipped (non-prod only)")
        return True

    if plain_secret_header and hmac.compare_digest(plain_secret_header.strip(), secret):
        return True
    if bearer:
        token = bearer.removeprefix("Bearer ").strip()
        if token and hmac.compare_digest(token, secret):
            return True
    if signature:
        digest = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
        provided = signature.removeprefix("sha256=").strip()
        if hmac.compare_digest(digest, provided):
            return True
    return False


def resolve_user(db: Session, payload: dict) -> User | None:
    user_id = payload.get("userId") or payload.get("user_id") or payload.get("id")
    if user_id is not None and str(user_id).strip():
        try:
            uid = int(str(user_id).strip())
        except ValueError:
            uid = None
        if uid is not None:
            user = db.get(User, uid)
            if user is not None:
                return user

    email = (
        payload.get("email")
        or payload.get("customer_email")
        or payload.get("userEmail")
        or ""
    )
    email = str(email).strip().lower()
    if not email:
        return None
    return db.scalar(select(User).where(User.email == email))


def apply_subscription_status(db: Session, user: User, new_status: str) -> dict:
    user.subscription_status = new_status
    db.commit()
    logger.info(
        "Webhook set user_id=%s email=%s subscription_status=%s",
        user.id,
        user.email,
        new_status,
    )
    return {
        "received": True,
        "updated": True,
        "userId": user.id,
        "email": user.email,
        "subscription_status": new_status,
    }


async def _read_verified_payload(
    request: Request,
    *,
    x_make_signature: str | None,
    x_grow_signature: str | None,
    x_webhook_secret: str | None,
    authorization: str | None,
) -> dict:
    import json

    raw = await request.body()
    sig = x_make_signature or x_grow_signature
    if not verify_webhook_auth(
        raw,
        signature=sig,
        bearer=authorization,
        plain_secret_header=x_webhook_secret,
    ):
        raise HTTPException(status_code=401, detail="Invalid webhook authentication")
    try:
        payload = json.loads(raw.decode("utf-8") or "{}")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON") from None
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Payload must be a JSON object")
    return payload


@router.post("/payment-success")
async def payment_success(
    request: Request,
    db: Session = Depends(get_db),
    x_make_signature: str | None = Header(default=None, alias="X-Make-Signature"),
    x_grow_signature: str | None = Header(default=None, alias="X-Grow-Signature"),
    x_webhook_secret: str | None = Header(default=None, alias="X-Webhook-Secret"),
    authorization: str | None = Header(default=None),
):
    """Make → site: payment / standing order approved → ACTIVE."""
    payload = await _read_verified_payload(
        request,
        x_make_signature=x_make_signature,
        x_grow_signature=x_grow_signature,
        x_webhook_secret=x_webhook_secret,
        authorization=authorization,
    )
    user = resolve_user(db, payload)
    if user is None:
        return {"received": True, "updated": False, "reason": "user_not_found"}
    result = apply_subscription_status(db, user, "active")
    result["redirect"] = "/thank-you"
    return result


@router.post("/subscription-cancelled")
async def subscription_cancelled(
    request: Request,
    db: Session = Depends(get_db),
    x_make_signature: str | None = Header(default=None, alias="X-Make-Signature"),
    x_grow_signature: str | None = Header(default=None, alias="X-Grow-Signature"),
    x_webhook_secret: str | None = Header(default=None, alias="X-Webhook-Secret"),
    authorization: str | None = Header(default=None),
):
    """Make → site: standing order cancelled → INACTIVE."""
    payload = await _read_verified_payload(
        request,
        x_make_signature=x_make_signature,
        x_grow_signature=x_grow_signature,
        x_webhook_secret=x_webhook_secret,
        authorization=authorization,
    )
    user = resolve_user(db, payload)
    if user is None:
        return {"received": True, "updated": False, "reason": "user_not_found"}
    return apply_subscription_status(db, user, "inactive")
