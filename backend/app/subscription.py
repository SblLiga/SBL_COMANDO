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
# Manager promotion only (not regular-user enrollment): live from the 23rd so
# they can pick next_month_target before users open on the 25th.
MANAGER_ROLE_EFFECTIVE_DAY = 23
# Inclusive last day of the immediate-promotion + plan-selection window (23 and 24).
MANAGER_IMMEDIATE_PROMOTION_LAST_DAY = 24
# Wait for Grow's next standing-order charge before locking the user out.
RENEWAL_GRACE_DAYS = 4


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
    """Regular users: deferred outside the 25–26 assignment window."""
    day = _israel_now(now).day
    return day != ASSIGNMENT_OPEN_DAY and day != IMMEDIATE_ENROLLMENT_LAST_DAY


def is_immediate_manager_promotion(now: datetime | None = None) -> bool:
    """Manager role grant: immediate on the 23rd–24th (before users open on the 25th)."""
    day = _israel_now(now).day
    return MANAGER_ROLE_EFFECTIVE_DAY <= day <= MANAGER_IMMEDIATE_PROMOTION_LAST_DAY


def next_assignment_open_at(now: datetime | None = None) -> datetime:
    """Next user-assignment open (25th 00:00 Israel). Used for subscriptions / demotions."""
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


def next_manager_role_effective_at(now: datetime | None = None) -> datetime:
    """Next manager-promotion effective instant (23rd 00:00 Israel)."""
    local = _israel_now(now)
    year, month = local.year, local.month
    if local.day >= MANAGER_ROLE_EFFECTIVE_DAY:
        if month == 12:
            year += 1
            month = 1
        else:
            month += 1
    start_local = datetime(year, month, MANAGER_ROLE_EFFECTIVE_DAY, 0, 0, 0, tzinfo=_ISRAEL)
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
    """
    Successful Grow standing-order / renewal charge.

    Never defer start into the future (that would bounce a paying member to /pending).
    If they still have paid-through time, extend from the current end so months overlap
    and there is no inactive gap while the next charge is in flight.
    If they already lapsed, restore access immediately from now.
    """
    _ = period_days
    now = _utcnow()
    old_end = _as_utc(user.subscription_end_date) if user.subscription_end_date else None
    old_start = _as_utc(user.subscription_start_date) if user.subscription_start_date else None

    if old_start is None or old_start > now:
        user.subscription_start_date = now
    # else keep original start — they already had access this cycle

    user.subscription_status = "active"
    base = old_end if old_end is not None and old_end > now else now
    user.subscription_end_date = end_of_immediate_paid_through_after(base)


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
    # Legacy active rows with no calendar end (and no start) — do not wipe on deploy.
    if end is None:
        if start is None:
            return False
        deactivate_subscription(user, db)
        db.commit()
        db.refresh(user)
        return True
    if now <= _as_utc(end):
        return False
    # Grace: Grow recurring webhooks often arrive on/after the 25th. Keep access
    # briefly so a successful charge can renew before we flip them inactive.
    if now <= _as_utc(end) + timedelta(days=RENEWAL_GRACE_DAYS):
        return False

    deactivate_subscription(user, db)
    db.commit()
    db.refresh(user)
    return True


def sync_user_group_from_member(user: User, db: Session) -> bool:
    """Keep User.group_id aligned with Member.group_id for pending/dashboard gates."""
    member = db.scalar(select(Member).where(Member.user_id == user.id).limit(1))
    if member is None:
        return False
    desired = member.group_id
    if user.group_id == desired:
        return False
    user.group_id = desired
    db.commit()
    db.refresh(user)
    return True
