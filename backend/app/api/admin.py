"""Dedicated admin operations that must not share the generic entity mutation flow."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.auth.deps import bearer_scheme
from app.auth.jwt import decode_access_token
from app.cycle_xp import MANAGER_CYCLE_ROLLOVER_DAY, current_cycle_month
from app.database import get_db
from app.models import Goal, Group, Member, User
from app.subscription import is_immediate_manager_promotion

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])


def require_admin_without_auth_side_effects(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Authenticate an admin without running the global lazy promotion tick."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        user_id = int(decode_access_token(credentials.credentials)["sub"])
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    actor = db.get(User, user_id)
    if actor is None or not actor.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if actor.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return actor


def promote_user_immediately(
    db: Session,
    *,
    actor_admin_id: int,
    target_user_id: int,
    now: datetime | None = None,
) -> dict:
    """Apply the isolated mid-month promotion inside the caller's transaction."""
    timestamp = now or datetime.now(timezone.utc)

    if is_immediate_manager_promotion(timestamp):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="קידום מיידי באמצע החודש אינו זמין בחלון 23–26; יש להשתמש בתהליך הרגיל.",
        )

    target = db.scalar(
        select(User).where(User.id == target_user_id).with_for_update()
    )
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="המשתמש לא נמצא.")
    if not target.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="לא ניתן לקדם משתמש שאינו פעיל.",
        )
    if target.role != "user" or bool(target.pending_manager):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="המשתמש כבר מנהל או ממתין לקידום.",
        )

    # Member has no is_active column. Multiple linked rows are ambiguous and
    # still require manual repair. No linked row is valid for users promoted
    # before onboarding; the minimal row is created in this transaction below.
    members = list(
        db.scalars(
            select(Member).where(Member.user_id == target_user_id).with_for_update()
        ).all()
    )
    if len(members) > 1:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="נמצאו מספר רשומות Member עבור המשתמש; נדרשת בדיקה ידנית.",
        )

    member = members[0] if members else None
    if member is not None and member.role == "manager":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="המשתמש כבר מנהל או ממתין לקידום.",
        )

    previous_group_id = (
        int(member.group_id)
        if member is not None and member.group_id is not None
        else None
    )
    if previous_group_id is not None:
        previous_group = db.scalar(
            select(Group).where(Group.id == previous_group_id).with_for_update()
        )
        if previous_group is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="לא ניתן לקדם: הקבוצה המשויכת אינה קיימת.",
            )
        if previous_group.manager_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="לא ניתן לקדם: לקבוצה המשויכת אין מנהל.",
            )
        if int(previous_group.manager_id) == int(target.id):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="לא ניתן לקדם: המשתמש כבר מוגדר כמנהל הקבוצה.",
            )

    goal = None
    if member is not None and member.goal_id is not None:
        goal = db.scalar(select(Goal).where(Goal.id == int(member.goal_id)).with_for_update())

    # All guards above are read-only. Mutations start here and remain in the
    # current request transaction until the route commits once.
    target.role = "manager"
    target.pending_manager = False
    target.pending_demotion = False
    target.manager_effective_on = None
    target.onboarding_completed = True
    target.group_id = None

    if member is None:
        member = Member(
            name=target.full_name or target.email,
            user_id=target.id,
            role="manager",
        )
        db.add(member)

    member.role = "manager"
    member.group_id = None
    member.group_name = None

    # Prevent the existing lazy cycle serializer from interpreting the role
    # change as a rollover and resetting score before the preserve-stats plan
    # UI can load. Only the cycle label changes; score and goal identity remain.
    if goal is not None:
        goal.cycle_month = current_cycle_month(
            timestamp,
            rollover_day=MANAGER_CYCLE_ROLLOVER_DAY,
        )

    if previous_group_id is not None:
        decrement = db.execute(
            update(Group)
            .where(Group.id == previous_group_id, Group.participant_count > 0)
            .values(participant_count=Group.participant_count - 1)
        )
        if decrement.rowcount == 0:
            logger.warning(
                'admin_action action="mid_month_promotion" actor_admin_id=%s '
                "target_user_id=%s previous_group_id=%s timestamp=%s warning=participant_count_not_decremented",
                actor_admin_id,
                target_user_id,
                previous_group_id,
                timestamp.isoformat(),
            )

    db.flush()
    logger.info(
        'admin_action action="mid_month_promotion" actor_admin_id=%s '
        "target_user_id=%s previous_group_id=%s timestamp=%s transaction_state=pending_commit",
        actor_admin_id,
        target_user_id,
        previous_group_id,
        timestamp.isoformat(),
    )
    return {
        "user_id": str(target.id),
        "role": "manager",
        "previous_group_id": str(previous_group_id) if previous_group_id is not None else None,
        "timestamp": timestamp.isoformat(),
        "requires_manager_goal_selection": True,
        "manager_goal_selection": {"reset_stats": False},
        "message": "המשתמש קודם למנהל ועליו לבחור יעד חדש; הניקוד והרצף נשמרו.",
    }


@router.post("/users/{user_id}/promote-immediate")
def promote_immediate(
    user_id: int,
    db: Session = Depends(get_db),
    actor: User = Depends(require_admin_without_auth_side_effects),
):
    logger.info(
        'admin_action_attempt action="mid_month_promotion" actor_admin_id=%s target_user_id=%s',
        actor.id,
        user_id,
    )
    try:
        result = promote_user_immediately(
            db,
            actor_admin_id=int(actor.id),
            target_user_id=user_id,
        )
        db.commit()
    except HTTPException as exc:
        db.rollback()
        logger.warning(
            'admin_action_rejected action="mid_month_promotion" actor_admin_id=%s '
            "target_user_id=%s status_code=%s detail=%s",
            actor.id,
            user_id,
            exc.status_code,
            exc.detail,
        )
        raise
    except Exception:
        db.rollback()
        logger.exception(
            'admin_action_failed action="mid_month_promotion" actor_admin_id=%s target_user_id=%s',
            actor.id,
            user_id,
        )
        raise

    logger.info(
        'admin_action_committed action="mid_month_promotion" actor_admin_id=%s '
        "target_user_id=%s previous_group_id=%s timestamp=%s",
        actor.id,
        user_id,
        result["previous_group_id"],
        result["timestamp"],
    )
    return result
