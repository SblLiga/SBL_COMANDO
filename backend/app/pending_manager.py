"""Manager promotion/demotion scheduling.

Promotion (user → manager):
- Immediate on calendar days 23–24 (Asia/Jerusalem) so they can pick a target
  before regular users open on the 25th.
- Otherwise queued until the next 23rd (manager_effective_on).

Demotion (manager → user) and regular-user enrollment still use the 25th window
via is_deferred_enrollment / next_assignment_open_at — unchanged.
"""

from __future__ import annotations

import logging

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models import Member, User
from app.subscription import (
    _utcnow,
    is_deferred_enrollment,
    is_immediate_manager_promotion,
    next_assignment_open_at,
    next_manager_role_effective_at,
)

logger = logging.getLogger(__name__)


def _clear_schedule(user: User) -> None:
    user.pending_manager = False
    user.pending_demotion = False
    user.manager_effective_on = None


def activate_manager_now(db: Session, user: User) -> None:
    """Flip to live manager. Does not pull them out of a group until cycle rules do."""
    user.role = "manager"
    _clear_schedule(user)
    user.onboarding_completed = True
    if (user.subscription_status or "").lower() != "active":
        user.subscription_status = "active"

    member = db.scalar(select(Member).where(Member.user_id == user.id).limit(1))
    if member is not None:
        member.role = "manager"
        db.add(member)
    db.add(user)


def demote_manager_now(db: Session, user: User) -> None:
    """Flip to regular user. Leaves group membership as-is."""
    user.role = "user"
    _clear_schedule(user)
    member = db.scalar(select(Member).where(Member.user_id == user.id).limit(1))
    if member is not None:
        member.role = "user"
        db.add(member)
    db.add(user)


def schedule_manager_for_next_cycle(user: User) -> None:
    """Keep current user role + group; become live manager from the next 23rd."""
    user.role = "user"
    user.pending_manager = True
    user.pending_demotion = False
    user.manager_effective_on = next_manager_role_effective_at()
    logger.info(
        "Scheduled manager promotion user_id=%s effective_on=%s",
        user.id,
        user.manager_effective_on,
    )


def schedule_demotion_for_next_cycle(user: User) -> None:
    """Stay a live manager this cycle; become a regular user from next 25th."""
    user.role = "manager"
    user.pending_manager = False
    user.pending_demotion = True
    user.manager_effective_on = next_assignment_open_at()
    logger.info(
        "Scheduled manager demotion user_id=%s effective_on=%s",
        user.id,
        user.manager_effective_on,
    )


def apply_admin_user_role(db: Session, user: User, new_role: str) -> None:
    """Admin role toggle. Promotion uses 23–24; demotion still uses 25–26."""
    role = (new_role or "").strip().lower()
    # Demotion / cancel: regular-user assignment window (25–26).
    deferred_user_window = is_deferred_enrollment()

    if role == "user":
        # Nominated but not live yet — cancel immediately.
        if user.pending_manager and user.role != "manager":
            demote_manager_now(db, user)
            return
        # Already a live manager: delay until next cycle unless we are in 25–26.
        if user.role == "manager":
            if deferred_user_window:
                schedule_demotion_for_next_cycle(user)
                db.add(user)
                return
            demote_manager_now(db, user)
            return
        demote_manager_now(db, user)
        return

    if role != "manager":
        user.role = role
        db.add(user)
        return

    # Undo a scheduled demotion — they stay manager into next month too.
    if user.role == "manager" and user.pending_demotion:
        _clear_schedule(user)
        db.add(user)
        return

    # Already a live manager — leave as-is.
    if user.role == "manager" and not user.pending_manager:
        return

    # Promotion: immediate on 23–24; otherwise queue for next 23rd.
    if is_immediate_manager_promotion():
        activate_manager_now(db, user)
        return

    schedule_manager_for_next_cycle(user)
    db.add(user)


def apply_scheduled_manager_promotions(db: Session) -> int:
    """Apply due promotions and demotions. Safe no-op for everyone else."""
    now = _utcnow()
    due = db.scalars(
        select(User).where(
            User.manager_effective_on.is_not(None),
            User.manager_effective_on <= now,
            or_(User.pending_manager.is_(True), User.pending_demotion.is_(True)),
        )
    ).all()
    count = 0
    changed = False
    for user in due:
        if user.role == "admin":
            _clear_schedule(user)
            changed = True
            continue
        if user.pending_demotion:
            demote_manager_now(db, user)
            logger.info("Pending manager demoted user_id=%s email=%s", user.id, user.email)
        else:
            activate_manager_now(db, user)
            logger.info("Pending manager activated user_id=%s email=%s", user.id, user.email)
        count += 1
        changed = True
    if changed:
        db.commit()
    return count


def clamp_member_role_to_user_status(db: Session, member: Member) -> None:
    """A Member is only 'manager' after the linked User is a live manager."""
    if member.user_id is None:
        return
    owner = db.get(User, int(member.user_id))
    if owner is None:
        return
    if owner.role != "manager" and member.role == "manager":
        member.role = "user"
