"""Deferred manager promotion: Shuli marks now, role becomes manager from the 25th.

Existing users with role=manager are untouched. Only new admin promotions
outside days 25–26 stay regular users in their group until the next 25th.
"""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Member, User
from app.subscription import (
    _utcnow,
    is_deferred_enrollment,
    next_assignment_open_at,
)

logger = logging.getLogger(__name__)


def activate_manager_now(db: Session, user: User) -> None:
    """Flip to live manager. Does not pull them out of a group until cycle rules do."""
    user.role = "manager"
    user.pending_manager = False
    user.manager_effective_on = None
    user.onboarding_completed = True
    if (user.subscription_status or "").lower() != "active":
        user.subscription_status = "active"

    member = db.scalar(select(Member).where(Member.user_id == user.id).limit(1))
    if member is not None:
        member.role = "manager"
        db.add(member)
    db.add(user)


def schedule_manager_for_next_cycle(user: User) -> None:
    """Keep current user role + group; become selectable manager from next 25th."""
    user.role = "user"
    user.pending_manager = True
    user.manager_effective_on = next_assignment_open_at()
    db_note = user.manager_effective_on
    logger.info(
        "Scheduled manager promotion user_id=%s effective_on=%s",
        user.id,
        db_note,
    )


def apply_admin_user_role(db: Session, user: User, new_role: str) -> None:
    """Admin toggle. Existing live managers stay immediate; new ones follow the calendar."""
    role = (new_role or "").strip().lower()
    if role == "user":
        user.role = "user"
        user.pending_manager = False
        user.manager_effective_on = None
        member = db.scalar(select(Member).where(Member.user_id == user.id).limit(1))
        if member is not None:
            member.role = "user"
            db.add(member)
        db.add(user)
        return

    if role != "manager":
        user.role = role
        db.add(user)
        return

    # Already a live manager — leave as-is (no pending rewrite).
    if user.role == "manager" and not user.pending_manager:
        return

    # Days 25–26: this cycle's assignment window — take effect now.
    if not is_deferred_enrollment():
        activate_manager_now(db, user)
        return

    schedule_manager_for_next_cycle(user)
    db.add(user)


def apply_scheduled_manager_promotions(db: Session) -> int:
    """Promote anyone whose 25th has arrived. Safe no-op for everyone else."""
    now = _utcnow()
    due = db.scalars(
        select(User).where(
            User.pending_manager.is_(True),
            User.manager_effective_on.is_not(None),
            User.manager_effective_on <= now,
        )
    ).all()
    count = 0
    changed = False
    for user in due:
        if user.role == "admin":
            user.pending_manager = False
            user.manager_effective_on = None
            changed = True
            continue
        activate_manager_now(db, user)
        count += 1
        changed = True
        logger.info("Pending manager activated user_id=%s email=%s", user.id, user.email)
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
