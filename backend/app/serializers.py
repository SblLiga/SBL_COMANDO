"""Serialize ORM models to API dicts (string ids, created_date alias)."""

from datetime import datetime
from typing import Any

from app.models import (
    Goal,
    Group,
    Meeting,
    Member,
    Notification,
    Report,
    SystemSetting,
    Task,
    User,
)


def _dt(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.isoformat()


def _with_dates(payload: dict[str, Any], created_at: datetime | None) -> dict[str, Any]:
    iso = _dt(created_at)
    payload["created_at"] = iso
    payload["created_date"] = iso
    return payload


def _sid(value: int | None) -> str | None:
    if value is None:
        return None
    return str(value)


def user_to_dict(user: User) -> dict[str, Any]:
    return _with_dates(
        {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "subscription_status": user.subscription_status,
            "subscription_end_date": _dt(user.subscription_end_date),
            "subscription_start_date": _dt(user.subscription_start_date),
            "gender": user.gender,
            "target": user.target,
            "onboarding_completed": user.onboarding_completed,
            "onboarding_completed_at": _dt(user.onboarding_completed_at),
            "group_id": _sid(user.group_id),
            "focus_target": user.focus_target,
            "focus_month": user.focus_month,
            "avatar_url": user.avatar_url,
        },
        user.created_at,
    )


def member_to_dict(member: Member) -> dict[str, Any]:
    return _with_dates(
        {
            "id": str(member.id),
            "name": member.name,
            "avatar_url": member.avatar_url,
            "xp": member.xp,
            "streak": member.streak,
            "gender": member.gender,
            "target": member.target,
            "group_name": member.group_name,
            "group_id": _sid(member.group_id),
            "progress": member.progress,
            "status": member.status,
            "role": member.role,
            "is_current_user": member.is_current_user,
            "goal_title": member.goal_title,
            "goal_id": _sid(member.goal_id),
            "goal_hidden": member.goal_hidden,
            "user_id": _sid(member.user_id),
            "next_month_target": member.next_month_target,
            "next_month_selected_at": _dt(member.next_month_selected_at),
            "last_login_date": _dt(member.last_login_date),
        },
        member.created_at,
    )


def group_to_dict(group: Group) -> dict[str, Any]:
    return _with_dates(
        {
            "id": str(group.id),
            "name": group.name,
            "description": group.description,
            "target": group.target,
            "gender": group.gender,
            "manager_name": group.manager_name,
            "manager_id": _sid(group.manager_id),
            "participant_count": group.participant_count,
            "max_participants": group.max_participants,
            "status": group.status,
            "avg_progress": group.avg_progress,
        },
        group.created_at,
    )


def goal_to_dict(goal: Goal) -> dict[str, Any]:
    return _with_dates(
        {
            "id": str(goal.id),
            "title": goal.title,
            "target": goal.target,
            "reward_text": goal.reward_text,
            "reward_image": goal.reward_image,
            "cycle_month": goal.cycle_month,
            "progress": goal.progress,
            "xp_total": goal.xp_total,
            "streak": goal.streak,
            "is_hidden": goal.is_hidden,
            "owner_user_id": _sid(goal.owner_user_id),
        },
        goal.created_at,
    )


def task_to_dict(task: Task) -> dict[str, Any]:
    return _with_dates(
        {
            "id": str(task.id),
            "goal_id": str(task.goal_id),
            "title": task.title,
            "order_index": task.order_index,
            "is_completed": task.is_completed,
            "priority": task.priority,
            "xp_value": task.xp_value,
        },
        task.created_at,
    )


def notification_to_dict(item: Notification) -> dict[str, Any]:
    return _with_dates(
        {
            "id": str(item.id),
            "target_user_id": _sid(item.target_user_id),
            "title": item.title,
            "body": item.body,
            "type": item.type,
            "is_read": item.is_read,
            "is_handled": item.is_handled,
            "source": item.source,
            "source_user_id": _sid(item.source_user_id),
        },
        item.created_at,
    )


def meeting_to_dict(item: Meeting) -> dict[str, Any]:
    return _with_dates(
        {
            "id": str(item.id),
            "group_id": _sid(item.group_id),
            "group_name": item.group_name,
            "scheduled_date": _dt(item.scheduled_date),
            "status": item.status,
            "current_section": item.current_section,
            "summary": item.summary,
            "section_reports": item.section_reports,
            "duration_minutes": item.duration_minutes,
            "is_locked": item.is_locked,
        },
        item.created_at,
    )


def report_to_dict(item: Report) -> dict[str, Any]:
    return _with_dates(
        {
            "id": str(item.id),
            "type": item.type,
            "status": item.status,
            "submitted_by": item.submitted_by,
            "content": item.content,
            "group_id": _sid(item.group_id),
        },
        item.created_at,
    )


def system_setting_to_dict(item: SystemSetting) -> dict[str, Any]:
    return _with_dates(
        {
            "id": str(item.id),
            "xp_task": item.xp_task,
            "xp_meeting": item.xp_meeting,
            "xp_goal": item.xp_goal,
        },
        item.created_at,
    )


SERIALIZERS = {
    "User": user_to_dict,
    "Member": member_to_dict,
    "Group": group_to_dict,
    "Goal": goal_to_dict,
    "Task": task_to_dict,
    "Notification": notification_to_dict,
    "Meeting": meeting_to_dict,
    "Report": report_to_dict,
    "SystemSetting": system_setting_to_dict,
}

MODEL_MAP = {
    "User": User,
    "Member": Member,
    "Group": Group,
    "Goal": Goal,
    "Task": Task,
    "Notification": Notification,
    "Meeting": Meeting,
    "Report": Report,
    "SystemSetting": SystemSetting,
}
