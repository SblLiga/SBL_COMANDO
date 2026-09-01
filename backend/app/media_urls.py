"""Helpers for durable media URLs (/api/media/...) vs legacy /uploads."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Member, User


def is_durable_media_url(url: str | None) -> bool:
    if not url or not isinstance(url, str):
        return False
    u = url.strip()
    return u.startswith("/api/media/") and len(u) > len("/api/media/")


def prefer_durable_url(*candidates: str | None) -> str | None:
    cleaned = [c.strip() for c in candidates if isinstance(c, str) and c.strip()]
    for c in cleaned:
        if is_durable_media_url(c):
            return c
    return cleaned[0] if cleaned else None


def sync_avatar_to_members(db: Session, user: User, avatar_url: str) -> None:
    """Keep Member.avatar_url in sync so League/HQ/Manager see the same photo."""
    if not avatar_url:
        return
    members = db.scalars(select(Member).where(Member.user_id == user.id)).all()
    for member in members:
        member.avatar_url = avatar_url


def heal_member_avatar(db: Session, member: Member) -> str | None:
    """
    Prefer durable Member.avatar_url; if missing/legacy, fall back to User.avatar_url
    and persist the heal so future lists are correct.
    """
    current = prefer_durable_url(member.avatar_url)
    if current:
        if current != member.avatar_url:
            member.avatar_url = current
            db.add(member)
        return current

    if not member.user_id:
        return member.avatar_url

    user = db.get(User, member.user_id)
    if user is None:
        return member.avatar_url

    healed = prefer_durable_url(user.avatar_url, member.avatar_url)
    if healed and healed != member.avatar_url:
        member.avatar_url = healed
        db.add(member)
    return healed or member.avatar_url
