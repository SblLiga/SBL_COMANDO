from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import asc, desc, select
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.database import get_db
from app.models import User
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

# Non-admins must not escalate privileges via entity CRUD
_PRIVILEGED_USER_FIELDS = {"role", "subscription_status", "email_verified", "password_hash", "email"}


def _strip_privileged(entity_name: str, data: dict[str, Any], actor: User) -> dict[str, Any]:
    if actor.role == "admin":
        return data
    if entity_name == "User":
        return {k: v for k, v in data.items() if k not in _PRIVILEGED_USER_FIELDS}
    if entity_name == "Member" and "role" in data:
        cleaned = dict(data)
        cleaned.pop("role", None)
        return cleaned
    return data


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


def _serialize(entity_name: str, row: Any) -> dict[str, Any]:
    return SERIALIZERS[entity_name](row)


def _apply_filters(query, model, criteria: dict[str, Any]):
    for key, value in criteria.items():
        if not hasattr(model, key):
            continue
        column = getattr(model, key)
        coerced = int(value) if key in INT_FIELDS and value is not None else value
        query = query.where(column == coerced)
    return query


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
    _user: User = Depends(get_current_user),
):
    model = MODEL_MAP.get(entity_name)
    if model is None:
        raise HTTPException(status_code=404, detail="Unknown entity")

    query = select(model)
    if sort:
        descending = sort.startswith("-")
        field = sort[1:] if descending else sort
        if hasattr(model, field):
            column = getattr(model, field)
            query = query.order_by(desc(column) if descending else asc(column))
    if limit:
        query = query.limit(limit)

    rows = db.scalars(query).all()
    return [_serialize(entity_name, row) for row in rows]


@router.post("/{entity_name}/filter")
def filter_entities(
    entity_name: str,
    payload: FilterRequest,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    model = MODEL_MAP.get(entity_name)
    if model is None:
        raise HTTPException(status_code=404, detail="Unknown entity")

    query = _apply_filters(select(model), model, payload.criteria)
    rows = db.scalars(query).all()
    return [_serialize(entity_name, row) for row in rows]


@router.get("/{entity_name}/{entity_id}")
def get_entity(
    entity_name: str,
    entity_id: str,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    model = MODEL_MAP.get(entity_name)
    if model is None:
        raise HTTPException(status_code=404, detail="Unknown entity")

    row = db.get(model, int(entity_id))
    if row is None:
        raise HTTPException(status_code=404, detail="Not found")
    return _serialize(entity_name, row)


@router.post("/{entity_name}")
def create_entity(
    entity_name: str,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    model = MODEL_MAP.get(entity_name)
    if model is None:
        raise HTTPException(status_code=404, detail="Unknown entity")
    if entity_name in {"User", "SystemSetting"} and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")

    data = _strip_privileged(entity_name, _coerce_payload(payload), current_user)
    allowed = {c.name for c in model.__table__.columns} - {"id", "created_at"}
    row = model(**{k: v for k, v in data.items() if k in allowed})
    db.add(row)
    db.commit()
    db.refresh(row)
    return _serialize(entity_name, row)


@router.patch("/{entity_name}/{entity_id}")
def update_entity(
    entity_name: str,
    entity_id: str,
    payload: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    model = MODEL_MAP.get(entity_name)
    if model is None:
        raise HTTPException(status_code=404, detail="Unknown entity")

    row = db.get(model, int(entity_id))
    if row is None:
        raise HTTPException(status_code=404, detail="Not found")

    data = _strip_privileged(entity_name, _coerce_payload(payload), current_user)
    allowed = {c.name for c in model.__table__.columns} - {"id", "created_at"}
    for key, value in data.items():
        if key in allowed:
            setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return _serialize(entity_name, row)


@router.post("/{entity_name}/bulk")
def bulk_create(
    entity_name: str,
    payload: BulkRequest,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    model = MODEL_MAP.get(entity_name)
    if model is None:
        raise HTTPException(status_code=404, detail="Unknown entity")

    allowed = {c.name for c in model.__table__.columns} - {"id", "created_at"}
    created = []
    for item in payload.items:
        data = _coerce_payload(item)
        row = model(**{k: v for k, v in data.items() if k in allowed})
        db.add(row)
        created.append(row)
    db.commit()
    for row in created:
        db.refresh(row)
    return [_serialize(entity_name, row) for row in created]


@router.patch("/{entity_name}/bulk")
def bulk_update(
    entity_name: str,
    payload: BulkRequest,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    model = MODEL_MAP.get(entity_name)
    if model is None:
        raise HTTPException(status_code=404, detail="Unknown entity")

    allowed = {c.name for c in model.__table__.columns} - {"id", "created_at"}
    updated = []
    for item in payload.items:
        entity_id = item.get("id")
        if entity_id is None:
            continue
        row = db.get(model, int(entity_id))
        if row is None:
            continue
        data = _coerce_payload({k: v for k, v in item.items() if k != "id"})
        for key, value in data.items():
            if key in allowed:
                setattr(row, key, value)
        updated.append(row)
    db.commit()
    for row in updated:
        db.refresh(row)
    return [_serialize(entity_name, row) for row in updated]


@router.delete("/{entity_name}/{entity_id}")
def delete_entity(
    entity_name: str,
    entity_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    model = MODEL_MAP.get(entity_name)
    if model is None:
        raise HTTPException(status_code=404, detail="Unknown entity")
    if entity_name in {"User", "SystemSetting"} and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")

    row = db.get(model, int(entity_id))
    if row is None:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(row)
    db.commit()
    return {"deleted": True}
