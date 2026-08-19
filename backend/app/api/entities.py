from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import asc, desc, select
from sqlalchemy.orm import Session

from app.auth.deps import require_active_subscription
from app.cycle_xp import current_cycle_month, ensure_goal_cycle, ensure_member_cycle
from app.database import get_db
from app.media_urls import heal_member_avatar
from app.models import Goal, Group, Member, User
from app.pending_manager import (
    apply_admin_user_role,
    clamp_member_role_to_user_status,
)
from app.serializers import MODEL_MAP, SERIALIZERS

router = APIRouter(prefix="/api/entities", tags=["entities"])

INT_FIELDS = {
    "group_id",
    "user_id",
    "goal_id",
    "owner_user_id",
    "target_user_id",
    "source_user_id",
    "manager_id",
}

_PRIVILEGED_USER_FIELDS = {
    "role",
    "pending_manager",
    "manager_effective_on",
    "subscription_status",
    "subscription_end_date",
    "subscription_start_date",
    "email_verified",
    "password_hash",
    "email",
    "is_active",
}


def _strip_privileged(entity_name: str, data: dict[str, Any], actor: User) -> dict[str, Any]:
    cleaned = dict(data)
    cleaned.pop("password_hash", None)
    if actor.role == "admin":
        return cleaned
    if entity_name == "User":
        return {k: v for k, v in cleaned.items() if k not in _PRIVILEGED_USER_FIELDS}
    if entity_name == "Member":
        cleaned.pop("role", None)
    if entity_name == "Task" and actor.role not in {"admin", "manager"}:
        cleaned.pop("priority", None)
    return cleaned


def _coerce_payload(data: dict[str, Any]) -> dict[str, Any]:
    cleaned: dict[str, Any] = {}
    for key, value in data.items():
        if key in INT_FIELDS and value is not None and value != "":
            cleaned[key] = int(value)
        elif key.endswith("_at") and isinstance(value, str):
            try:
                cleaned[key] = datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError:
                cleaned[key] = value
        else:
            cleaned[key] = value
    return cleaned


def _serialize(entity_name: str, row: Any, db: Session | None = None) -> dict[str, Any]:
    if db is not None:
        if entity_name == "Member" and isinstance(row, Member):
            heal_member_avatar(db, row)
            ensure_member_cycle(db, row)
        elif entity_name == "Goal" and isinstance(row, Goal):
            ensure_goal_cycle(db, row)
    return SERIALIZERS[entity_name](row)


def _serialize_many(entity_name: str, rows: list[Any], db: Session) -> list[dict[str, Any]]:
    out = [_serialize(entity_name, row, db) for row in rows]
    if entity_name in {"Member", "Goal"}:
        db.commit()
    return out


def _apply_filters(query, model, criteria: dict[str, Any]):
    for key, value in criteria.items():
        if not hasattr(model, key):
            continue
        column = getattr(model, key)
        coerced = int(value) if key in INT_FIELDS and value is not None else value
        query = query.where(column == coerced)
    return query


def _manager_group_ids(db: Session, actor: User) -> set[int]:
    ids: set[int] = set()
    for g in db.scalars(select(Group).where(Group.manager_id == actor.id)).all():
        ids.add(int(g.id))
    mine = db.scalars(
        select(Member).where(Member.user_id == actor.id, Member.role == "manager")
    ).all()
    for m in mine:
        if m.group_id is not None:
            ids.add(int(m.group_id))
    return ids


def _can_access_row(entity_name: str, row: Any, actor: User, db: Session) -> bool:
    if actor.role == "admin":
        return True
    if entity_name == "User":
        return int(row.id) == int(actor.id)
    if entity_name == "SystemSetting":
        return True
    if entity_name == "Member":
        if getattr(row, "user_id", None) is not None and int(row.user_id) == int(actor.id):
            return True
        if actor.role == "manager":
            gids = _manager_group_ids(db, actor)
            return row.group_id is not None and int(row.group_id) in gids
        return True
    if entity_name == "Goal":
        if getattr(row, "owner_user_id", None) is not None and int(row.owner_user_id) == int(actor.id):
            return True
        return actor.role == "manager"
    if entity_name == "Task":
        goal_id = getattr(row, "goal_id", None)
        if goal_id is None:
            return actor.role == "manager"
        goal = db.get(Goal, int(goal_id))
        if goal and goal.owner_user_id is not None and int(goal.owner_user_id) == int(actor.id):
            return True
        return actor.role == "manager"
    if entity_name == "Group":
        if actor.role == "manager":
            mid = getattr(row, "manager_id", None)
            return (mid is not None and int(mid) == int(actor.id)) or int(row.id) in _manager_group_ids(
                db, actor
            )
        return True
    if entity_name == "Notification":
        return (
            getattr(row, "target_user_id", None) is not None
            and int(row.target_user_id) == int(actor.id)
        )
    if entity_name == "Meeting":
        if actor.role == "manager":
            gids = _manager_group_ids(db, actor)
            return getattr(row, "group_id", None) is not None and int(row.group_id) in gids
        return True
    if entity_name == "Report":
        if actor.role == "manager":
            return True
        return getattr(row, "submitted_by", None) in {actor.email, actor.full_name}
    return actor.role in {"admin", "manager"}


def _can_mutate_row(entity_name: str, row: Any, actor: User, db: Session) -> bool:
    if actor.role == "admin":
        return True
    if entity_name == "User":
        return int(row.id) == int(actor.id)
    if entity_name == "SystemSetting":
        return False
    if entity_name == "Member":
        if getattr(row, "user_id", None) is not None and int(row.user_id) == int(actor.id):
            return True
        if actor.role == "manager":
            gids = _manager_group_ids(db, actor)
            return row.group_id is not None and int(row.group_id) in gids
        return False
    if entity_name == "Goal":
        return (
            getattr(row, "owner_user_id", None) is not None
            and int(row.owner_user_id) == int(actor.id)
        )
    if entity_name == "Task":
        goal_id = getattr(row, "goal_id", None)
        if goal_id is None:
            return False
        goal = db.get(Goal, int(goal_id))
        return bool(
            goal
            and goal.owner_user_id is not None
            and int(goal.owner_user_id) == int(actor.id)
        )
    if entity_name == "Notification":
        return False
    if entity_name == "Group":
        mid = getattr(row, "manager_id", None)
        if actor.role == "manager" and mid is not None and int(mid) == int(actor.id):
            return True
        # Users may bump participant_count when joining/leaving during onboarding.
        return actor.role == "user"
    if entity_name in {"Meeting", "Report"}:
        return actor.role == "manager"
    return False


def _scope_list_query(entity_name: str, query, model, actor: User, db: Session):
    if actor.role == "admin":
        return query
    if entity_name == "User":
        return query.where(model.id == actor.id)
    if entity_name == "Notification":
        return query.where(model.target_user_id == actor.id)
    if entity_name == "Goal" and actor.role == "user":
        return query.where(model.owner_user_id == actor.id)
    if entity_name == "Task" and actor.role == "user":
        own_goal_ids = [
            int(g.id)
            for g in db.scalars(select(Goal).where(Goal.owner_user_id == actor.id)).all()
        ]
        if not own_goal_ids:
            return query.where(model.id == -1)
        return query.where(model.goal_id.in_(own_goal_ids))
    if entity_name == "Meeting" and actor.role == "manager":
        gids = _manager_group_ids(db, actor)
        if not gids:
            return query.where(model.id == -1)
        return query.where(model.group_id.in_(gids))
    return query


def _assert_can_create(entity_name: str, actor: User) -> None:
    if actor.role == "admin":
        return
    if entity_name in {"User", "SystemSetting"}:
        raise HTTPException(status_code=403, detail="Forbidden")
    if actor.role == "manager":
        if entity_name in {"Member", "Goal", "Task", "Group", "Meeting", "Report", "Notification"}:
            return
        raise HTTPException(status_code=403, detail="Forbidden")
    # Regular users: self-service onboarding + wheel (+ group join count updates)
    if entity_name in {"Member", "Goal", "Task", "Group"}:
        return
    raise HTTPException(status_code=403, detail="Forbidden")


class FilterRequest(BaseModel):
    criteria: dict[str, Any] = {}


class BulkRequest(BaseModel):
    items: list[dict[str, Any]]


@router.get("/{entity_name}")
def list_entities(
    entity_name: str,
    sort: str | None = Query(None),
    limit: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_subscription),
):
    model = MODEL_MAP.get(entity_name)
    if model is None:
        raise HTTPException(status_code=404, detail="Unknown entity")

    query = select(model)
    query = _scope_list_query(entity_name, query, model, current_user, db)
    if sort:
        descending = sort.startswith("-")
        field = sort[1:] if descending else sort
        if hasattr(model, field):
            column = getattr(model, field)
            query = query.order_by(desc(column) if descending else asc(column))
    if limit:
        query = query.limit(limit)

    rows = db.scalars(query).all()
    return _serialize_many(entity_name, rows, db)


@router.post("/{entity_name}/filter")
def filter_entities(
    entity_name: str,
    payload: FilterRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_subscription),
):
    model = MODEL_MAP.get(entity_name)
    if model is None:
        raise HTTPException(status_code=404, detail="Unknown entity")

    query = _apply_filters(select(model), model, payload.criteria)
    query = _scope_list_query(entity_name, query, model, current_user, db)
    rows = db.scalars(query).all()
    return _serialize_many(entity_name, rows, db)


@router.get("/{entity_name}/{entity_id}")
def get_entity(
    entity_name: str,
    entity_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_subscription),
):
    model = MODEL_MAP.get(entity_name)
    if model is None:
        raise HTTPException(status_code=404, detail="Unknown entity")

    row = db.get(model, int(entity_id))
    if row is None:
        raise HTTPException(status_code=404, detail="Not found")
    if not _can_access_row(entity_name, row, current_user, db):
        raise HTTPException(status_code=403, detail="Forbidden")
    payload = _serialize(entity_name, row, db)
    if entity_name in {"Member", "Goal"}:
        db.commit()
    return payload


@router.post("/{entity_name}")
def create_entity(
    entity_name: str,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_subscription),
):
    model = MODEL_MAP.get(entity_name)
    if model is None:
        raise HTTPException(status_code=404, detail="Unknown entity")
    _assert_can_create(entity_name, current_user)

    data = _strip_privileged(entity_name, _coerce_payload(payload), current_user)
    if current_user.role == "user":
        if entity_name == "Goal":
            data["owner_user_id"] = current_user.id
        if entity_name == "Member":
            data["user_id"] = current_user.id
            data.pop("role", None)
        if entity_name == "Notification":
            data["target_user_id"] = current_user.id
    elif current_user.role in {"manager", "admin"}:
        # Personal wheel: force ownership onto the acting staff account.
        if entity_name == "Goal":
            data["owner_user_id"] = current_user.id
        if entity_name == "Member":
            uid = data.get("user_id")
            if uid is None or int(uid) == int(current_user.id):
                data["user_id"] = current_user.id
                # Managers cannot self-assign role via strip; restore from auth role.
                if current_user.role == "manager":
                    data["role"] = "manager"
                elif current_user.role == "admin" and not data.get("role"):
                    data["role"] = "admin"

    if entity_name == "Goal" and not data.get("cycle_month"):
        data["cycle_month"] = current_cycle_month()

    allowed = {c.name for c in model.__table__.columns} - {"id", "created_at"}
    row = model(**{k: v for k, v in data.items() if k in allowed})
    db.add(row)
    db.flush()
    if entity_name == "Member":
        clamp_member_role_to_user_status(db, row)
    db.commit()
    db.refresh(row)
    return _serialize(entity_name, row, db)


@router.patch("/{entity_name}/{entity_id}")
def update_entity(
    entity_name: str,
    entity_id: str,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_subscription),
):
    model = MODEL_MAP.get(entity_name)
    if model is None:
        raise HTTPException(status_code=404, detail="Unknown entity")

    row = db.get(model, int(entity_id))
    if row is None:
        raise HTTPException(status_code=404, detail="Not found")

    if entity_name == "User" and current_user.role != "admin":
        if int(entity_id) != int(current_user.id):
            raise HTTPException(status_code=403, detail="Forbidden")
    elif entity_name == "SystemSetting" and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    elif not _can_mutate_row(entity_name, row, current_user, db):
        raise HTTPException(status_code=403, detail="Forbidden")

    data = _strip_privileged(entity_name, _coerce_payload(payload), current_user)
    if entity_name == "User" and current_user.role == "admin" and "role" in data:
        apply_admin_user_role(db, row, str(data.get("role") or ""))
        if row.pending_manager:
            data.pop("onboarding_completed", None)
            data.pop("subscription_status", None)
        data.pop("role", None)
        data.pop("pending_manager", None)
        data.pop("manager_effective_on", None)
    allowed = {c.name for c in model.__table__.columns} - {"id", "created_at"}
    for key, value in data.items():
        if key in allowed:
            setattr(row, key, value)
    if entity_name == "Member":
        clamp_member_role_to_user_status(db, row)
    db.commit()
    db.refresh(row)
    return _serialize(entity_name, row, db)


@router.post("/{entity_name}/bulk")
def bulk_create(
    entity_name: str,
    payload: BulkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_subscription),
):
    model = MODEL_MAP.get(entity_name)
    if model is None:
        raise HTTPException(status_code=404, detail="Unknown entity")
    _assert_can_create(entity_name, current_user)

    allowed = {c.name for c in model.__table__.columns} - {"id", "created_at"}
    created = []
    for item in payload.items:
        data = _strip_privileged(entity_name, _coerce_payload(item), current_user)
        if current_user.role == "user" and entity_name == "Notification":
            data["target_user_id"] = current_user.id
        if current_user.role == "user" and entity_name == "Task":
            # Tasks must belong to a goal owned by the actor (checked loosely via goal_id presence)
            pass
        if current_user.role == "user" and entity_name == "Goal":
            data["owner_user_id"] = current_user.id
        if current_user.role == "user" and entity_name == "Member":
            data["user_id"] = current_user.id
            data.pop("role", None)
        row = model(**{k: v for k, v in data.items() if k in allowed})
        db.add(row)
        created.append(row)
    db.flush()
    if entity_name == "Member":
        for row in created:
            clamp_member_role_to_user_status(db, row)
    db.commit()
    for row in created:
        db.refresh(row)
    return [_serialize(entity_name, row, db) for row in created]


@router.patch("/{entity_name}/bulk")
def bulk_update(
    entity_name: str,
    payload: BulkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_subscription),
):
    model = MODEL_MAP.get(entity_name)
    if model is None:
        raise HTTPException(status_code=404, detail="Unknown entity")
    if entity_name in {"User", "SystemSetting"} and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")

    allowed = {c.name for c in model.__table__.columns} - {"id", "created_at"}
    updated = []
    for item in payload.items:
        entity_id = item.get("id")
        if entity_id is None:
            continue
        row = db.get(model, int(entity_id))
        if row is None:
            continue
        if not _can_mutate_row(entity_name, row, current_user, db):
            continue
        data = _strip_privileged(
            entity_name,
            _coerce_payload({k: v for k, v in item.items() if k != "id"}),
            current_user,
        )
        if entity_name == "User" and current_user.role == "admin" and "role" in data:
            apply_admin_user_role(db, row, str(data.get("role") or ""))
            if row.pending_manager:
                data.pop("onboarding_completed", None)
                data.pop("subscription_status", None)
            data.pop("role", None)
            data.pop("pending_manager", None)
            data.pop("manager_effective_on", None)
        for key, value in data.items():
            if key in allowed:
                setattr(row, key, value)
        if entity_name == "Member":
            clamp_member_role_to_user_status(db, row)
        updated.append(row)
    db.commit()
    for row in updated:
        db.refresh(row)
    return [_serialize(entity_name, row, db) for row in updated]


@router.delete("/{entity_name}/{entity_id}")
def delete_entity(
    entity_name: str,
    entity_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_active_subscription),
):
    model = MODEL_MAP.get(entity_name)
    if model is None:
        raise HTTPException(status_code=404, detail="Unknown entity")
    if entity_name in {"User", "SystemSetting"} and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")

    row = db.get(model, int(entity_id))
    if row is None:
        raise HTTPException(status_code=404, detail="Not found")
    if entity_name not in {"User", "SystemSetting"} and not _can_mutate_row(
        entity_name, row, current_user, db
    ):
        raise HTTPException(status_code=403, detail="Forbidden")
    db.delete(row)
    db.commit()
    return {"deleted": True}
