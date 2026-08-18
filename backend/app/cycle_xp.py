"""Monthly XP / wheel cycle helpers (Asia/Jerusalem).

From calendar day ≥ 25 the active cycle label advances to the next YYYY-MM.
When a Goal's cycle_month lags, XP and progress are zeroed for that Goal and
linked Member rows so league boards open clean for users, managers, and admins.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Goal, Member, Task

CYCLE_ROLLOVER_DAY = 25


def _israel_tz():
    try:
        return ZoneInfo("Asia/Jerusalem")
    except ZoneInfoNotFoundError:
        return timezone(timedelta(hours=3))


_ISRAEL = _israel_tz()


def current_cycle_month(now: datetime | None = None) -> str:
    """Active league cycle label (YYYY-MM). From day ≥ 25 → next calendar month."""
    if now is None:
        local = datetime.now(_ISRAEL)
    elif now.tzinfo is None:
        local = now.replace(tzinfo=timezone.utc).astimezone(_ISRAEL)
    else:
        local = now.astimezone(_ISRAEL)

    year, month = local.year, local.month
    if local.day >= CYCLE_ROLLOVER_DAY:
        if month == 12:
            year, month = year + 1, 1
        else:
            month += 1
    return f"{year}-{month:02d}"


def ensure_goal_cycle(db: Session, goal: Goal | None) -> bool:
    """Stamp or roll Goal + linked Members/Tasks. Returns True if DB rows changed."""
    if goal is None:
        return False

    cycle = current_cycle_month()
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
        member.xp = 0.0
        member.progress = 0.0
        member.streak = 0
        db.add(member)

    return True


def ensure_member_cycle(db: Session, member: Member | None) -> bool:
    """Roll the Member's linked Goal (if any) into the current monthly cycle."""
    if member is None or member.goal_id is None:
        return False
    goal = db.get(Goal, int(member.goal_id))
    return ensure_goal_cycle(db, goal)
