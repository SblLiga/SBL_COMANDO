"""Subscription lifecycle: payment grants access; assignment is calendar-gated (25–26).

Asia/Jerusalem:
- Days 25–26: start=now; end=next month's 26th 23:59:59 (still active on next 25th).
- Days 27→24: start=next 25th; end=24th after that start, 23:59:59; no expire while now < start.
- Expiry (sync) or failed GROW webhook → inactive + unassign_user_from_group.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Group, Member, User

SUBSCRIPTION_PERIOD_DAYS = 30
IMMEDIATE_ENROLLMENT_LAST_DAY = 26
ASSIGNMENT_OPEN_DAY = 25
CYCLE_PAID_THROUGH_DAY = 24
IMMEDIATE_PAID_THROUGH_DAY = 26


def _israel_tz():
    try:
        return ZoneInfo("Asia/Jerusalem")
    except ZoneInfoNotFoundError:
        return timezone(timedelta(hours=3))


_ISRAEL = _israel_tz()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _israel_now(now: datetime | None = None) -> datetime:
    return _as_utc(now or _utcnow()).astimezone(_ISRAEL)


def is_deferred_enrollment(now: datetime | None = None) -> bool:
    day = _israel_now(now).day
    return day != ASSIGNMENT_OPEN_DAY and day != IMMEDIATE_ENROLLMENT_LAST_DAY


def next_assignment_open_at(now: datetime | None = None) -> datetime:
    local = _israel_now(now)
    year, month = local.year, local.month
    if local.day >= ASSIGNMENT_OPEN_DAY:
        if month == 12:
            year += 1
            month = 1
        else:
            month += 1
    start_local = datetime(year, month, ASSIGNMENT_OPEN_DAY, 0, 0, 0, tzinfo=_ISRAEL)
    return start_local.astimezone(timezone.utc)


def _israel_end_next_month(start: datetime, *, day: int) -> datetime:
    local = _as_utc(start).astimezone(_ISRAEL)
    year, month = local.year, local.month
    if month == 12:
        year += 1
        month = 1
    else:
        month += 1
    return datetime(year, month, day, 23, 59, 59, tzinfo=_ISRAEL).astimezone(timezone.utc)


def end_of_cycle_paid_through_after(start: datetime) -> datetime:
    """Wait-window paid-through: 24th 23:59:59 after start's month."""
    return _israel_end_next_month(start, day=CYCLE_PAID_THROUGH_DAY)


def end_of_immediate_paid_through_after(start: datetime) -> datetime:
    """Days 25–26 paid-through: 26th 23:59:59 after start's month."""
    return _israel_end_next_month(start, day=IMMEDIATE_PAID_THROUGH_DAY)


def unassign_user_from_group(user: User, db: Session) -> None:
    group_ids: set[int] = set()
    if user.group_id is not None:
        group_ids.add(user.group_id)
    user.group_id = None

    for member in db.scalars(select(Member).where(Member.user_id == user.id)).all():
        if member.group_id is not None:
            group_ids.add(member.group_id)
        member.group_id = None
        member.group_name = None

    for gid in group_ids:
        group = db.get(Group, gid)
        if group is not None and group.participant_count:
            group.participant_count = max(0, int(group.participant_count) - 1)


def activate_subscription(user: User, *, period_days: int = SUBSCRIPTION_PERIOD_DAYS) -> None:
    """Mark paid/active only — never assigns a group."""
    _ = period_days
    now = _utcnow()
    if is_deferred_enrollment(now):
        start = next_assignment_open_at(now)
        end = end_of_cycle_paid_through_after(start)
    else:
        start = now
        end = end_of_immediate_paid_through_after(start)
    user.subscription_status = "active"
    user.subscription_start_date = start
    user.subscription_end_date = end


def renew_subscription(user: User, *, period_days: int = SUBSCRIPTION_PERIOD_DAYS) -> None:
    """Successful renew/charge: recalculate calendar dates (same as activate)."""
    activate_subscription(user, period_days=period_days)


def deactivate_subscription(user: User, db: Session | None = None) -> None:
    user.subscription_status = "inactive"
    user.subscription_end_date = None
    user.subscription_start_date = None
    if db is not None:
        unassign_user_from_group(user, db)


def sync_subscription_expiry(user: User, db: Session) -> bool:
    """Clock backup: past end (and not before start) → inactive + unassign."""
    if user.role in {"admin", "manager"}:
        return False
    if user.subscription_status != "active":
        return False

    now = _utcnow()
    start = user.subscription_start_date
    if start is not None and now < _as_utc(start):
        return False

    end = user.subscription_end_date
    if end is None or now <= _as_utc(end):
        return False

    deactivate_subscription(user, db)
    db.commit()
    db.refresh(user)
    return True
