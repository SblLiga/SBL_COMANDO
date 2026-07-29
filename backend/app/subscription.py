"""Subscription lifecycle: active/inactive + 30-day billing period."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models import User

SUBSCRIPTION_PERIOD_DAYS = 30


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def activate_subscription(user: User, *, period_days: int = SUBSCRIPTION_PERIOD_DAYS) -> None:
    """Mark user active and extend paid-through date from now."""
    user.subscription_status = "active"
    user.subscription_end_date = _utcnow() + timedelta(days=period_days)


def renew_subscription(user: User, *, period_days: int = SUBSCRIPTION_PERIOD_DAYS) -> None:
    """Renew: add period from current end date when still valid, otherwise from now."""
    now = _utcnow()
    end = user.subscription_end_date
    if end is not None and end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    base = end if end is not None and end > now else now
    user.subscription_status = "active"
    user.subscription_end_date = base + timedelta(days=period_days)


def deactivate_subscription(user: User) -> None:
    user.subscription_status = "inactive"
    user.subscription_end_date = None


def sync_subscription_expiry(user: User, db: Session) -> bool:
    """
    If subscription period ended, flip to inactive.
    Returns True when the user record was mutated (caller should rely on refreshed state).
    """
    if user.role in {"admin", "manager"}:
        return False
    if user.subscription_status != "active":
        return False
    end = user.subscription_end_date
    if end is None:
        return False
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    if _utcnow() <= end:
        return False
    user.subscription_status = "inactive"
    db.commit()
    db.refresh(user)
    return True
