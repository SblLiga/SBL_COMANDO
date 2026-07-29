"""Make / payment webhooks — activate or deactivate user subscription."""

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
from app.subscription import (
    activate_subscription,
    deactivate_subscription,
    renew_subscription,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

# Official Grow / Meshulam webhook egress IPs
ALLOWED_GROW_IPS = frozenset(
    {
        "3.123.194.128",
        "3.124.62.248",
        "18.198.97.252",
        "3.75.43.49",
        "18.156.94.176",
        "18.158.107.17",
        "3.121.149.170",
        "3.76.166.104",
        "3.69.160.29",
        "3.78.79.166",
        "3.71.221.153",
        "3.78.131.18",
        "3.67.110.47",
        "18.192.112.151",
        "52.59.95.229",
        "18.158.145.146",
        "3.75.128.58",
        "3.78.28.179",
        "3.122.21.187",
        "3.66.126.119",
        "35.158.249.118",
        "52.29.70.254",
        "52.59.159.234",
        "3.76.183.119",
        "18.157.106.67",
        "18.197.238.68",
        "3.66.129.154",
        "3.77.123.153",
        "3.70.40.72",
    }
)


def _client_ip(request: Request) -> str:
    forwarded = (request.headers.get("x-forwarded-for") or "").strip()
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return ""


def _require_grow_ip(request: Request) -> None:
    ip = _client_ip(request)
    if ip in ALLOWED_GROW_IPS:
        return
    logger.warning("Rejected payment webhook from non-Grow IP: %s", ip)
    raise HTTPException(status_code=403, detail="Forbidden")


def _is_grow_recurring(payload: dict) -> bool:
    """True when Grow marks a standing-order run (paymentSource + directDebitId)."""
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    source = str(payload.get("paymentSource") or data.get("paymentSource") or "").strip()
    debit_id = payload.get("directDebitId") or data.get("directDebitId")
    # Grow API value (Hebrew): standing-order run
    return source == "ריצת הוראת קבע" and bool(debit_id)


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
        return hmac.compare_digest(digest, provided)
    return False


def resolve_user(db: Session, payload: dict) -> User | None:
    # Meshulam/Grow puts our user id in custom1 (see payment_url_for_user / buildGrowPaymentUrl).
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    custom_fields = (
        data.get("customFields") if isinstance(data.get("customFields"), dict) else {}
    )
    user_id = (
        payload.get("userId")
        or payload.get("user_id")
        or payload.get("custom1")
        or data.get("custom1")
        or custom_fields.get("custom1")
        or data.get("userId")
        or data.get("user_id")
        or payload.get("id")
    )
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
        payload.get("payerEmail")
        or payload.get("email")
        or payload.get("customer_email")
        or payload.get("userEmail")
        or data.get("payerEmail")
        or data.get("email")
        or data.get("customer_email")
        or data.get("userEmail")
        or ""
    )
    email = str(email).strip().lower()
    if not email:
        return None
    return db.scalar(select(User).where(User.email == email))


def apply_subscription_status(db: Session, user: User, new_status: str) -> dict:
    if new_status == "active":
        activate_subscription(user)
    else:
        deactivate_subscription(user)
    db.commit()
    db.refresh(user)
    logger.info(
        "Webhook set user_id=%s email=%s subscription_status=%s end=%s",
        user.id,
        user.email,
        user.subscription_status,
        user.subscription_end_date,
    )
    return {
        "received": True,
        "updated": True,
        "userId": user.id,
        "email": user.email,
        "subscription_status": user.subscription_status,
        "subscription_end_date": (
            user.subscription_end_date.isoformat() if user.subscription_end_date else None
        ),
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
    """Grow → site: payment approved → ACTIVE for 30 days (first charge or recurring)."""
    _require_grow_ip(request)
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

    recurring = _is_grow_recurring(payload)
    if recurring:
        renew_subscription(user)
        db.commit()
        db.refresh(user)
        logger.info(
            "Grow recurring renew user_id=%s email=%s end=%s directDebitId=%s",
            user.id,
            user.email,
            user.subscription_end_date,
            payload.get("directDebitId"),
        )
        result = {
            "received": True,
            "updated": True,
            "userId": user.id,
            "email": user.email,
            "subscription_status": user.subscription_status,
            "subscription_end_date": (
                user.subscription_end_date.isoformat() if user.subscription_end_date else None
            ),
            "renewal": True,
        }
    else:
        result = apply_subscription_status(db, user, "active")
        result["renewal"] = False

    result["redirect"] = "/thank-you"
    return result
