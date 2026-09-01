"""Monthly XP / wheel cycle helpers (Asia/Jerusalem).

Users: from calendar day ≥ 25 the cycle label advances to next YYYY-MM.
Managers: from calendar day ≥ 23 (personal wheel only).
Admins: never auto-reset by calendar — only on intentional target change in the app.

When a Goal's cycle_month lags, XP and progress are zeroed for that Goal and
linked Member rows. Never clears next_month_target / next_month_zone /
next_month_tasks / next_month_reward / next_month_selected_at, target, or group_id —
manager day-23 choices must survive the user day-25 enrollment reset.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Goal, Member, Task, User

USER_CYCLE_ROLLOVER_DAY = 25
MANAGER_CYCLE_ROLLOVER_DAY = 23


def _israel_tz():
    try:
        return ZoneInfo("Asia/Jerusalem")
    except ZoneInfoNotFoundError:
        return timezone(timedelta(hours=3))


_ISRAEL = _israel_tz()


def current_cycle_month(now: datetime | None = None, *, rollover_day: int = USER_CYCLE_ROLLOVER_DAY) -> str:
    """Active league cycle label (YYYY-MM) for the given rollover day."""
    if now is None:
        local = datetime.now(_ISRAEL)
    elif now.tzinfo is None:
        local = now.replace(tzinfo=timezone.utc).astimezone(_ISRAEL)
    else:
        local = now.astimezone(_ISRAEL)

    year, month = local.year, local.month
    if local.day >= rollover_day:
        if month == 12:
            year, month = year + 1, 1
        else:
            month += 1
    return f"{year}-{month:02d}"


def _owner_role(db: Session, goal: Goal) -> str | None:
    if goal.owner_user_id is None:
        return None
    owner = db.get(User, int(goal.owner_user_id))
    if not owner:
        return None
    return (owner.role or "").lower() or None


def ensure_goal_cycle(
    db: Session,
    goal: Goal | None,
    *,
    rollover_day: int | None = None,
) -> bool:
    """Stamp or roll Goal XP fields + linked Members/Tasks. Returns True if DB rows changed.

    Admins are never auto-rolled by calendar.
    When rollover_day is omitted, derive from Goal owner role (manager→23, else→25).
    Intentionally does NOT touch Member.next_month_target / target / group_id.
    """
    if goal is None:
        return False

    owner_role = _owner_role(db, goal)
    if owner_role == "admin":
        return False

    if rollover_day is None:
        rollover_day = (
            MANAGER_CYCLE_ROLLOVER_DAY if owner_role == "manager" else USER_CYCLE_ROLLOVER_DAY
        )

    cycle = current_cycle_month(rollover_day=rollover_day)
    if not goal.cycle_month:
        goal.cycle_month = cycle
        db.add(goal)
        return True

    if goal.cycle_month == cycle:
        return False

    goal.cycle_month = cycle
    goal.progress = 0.0
    goal.xp_total = 0.0
    goal.streak = 0
    db.add(goal)

    for task in db.scalars(select(Task).where(Task.goal_id == goal.id)).all():
        if task.is_completed:
            task.is_completed = False
            db.add(task)

    for member in db.scalars(select(Member).where(Member.goal_id == goal.id)).all():
        # XP board only — preserve next_month_target / group assignment fields.
        member.xp = 0.0
        member.progress = 0.0
        member.streak = 0
        db.add(member)

    return True


def ensure_member_cycle(db: Session, member: Member | None) -> bool:
    """Roll the Member's linked Goal into the role-appropriate monthly cycle."""
    if member is None or member.goal_id is None:
        return False
    role = (member.role or "user").lower()
    # Admin personal wheel: calendar never resets — only intentional target change in UI.
    if role == "admin":
        return False
    if member.user_id is not None:
        linked = db.get(User, int(member.user_id))
        if linked and (linked.role or "").lower() == "admin":
            return False
    rollover = MANAGER_CYCLE_ROLLOVER_DAY if role == "manager" else USER_CYCLE_ROLLOVER_DAY
    goal = db.get(Goal, int(member.goal_id))
    return ensure_goal_cycle(db, goal, rollover_day=rollover)
