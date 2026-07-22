from datetime import datetime, timedelta, timezone

import jwt

from app.config import get_settings


def create_access_token(subject: str, extra: dict | None = None) -> str:
    settings = get_settings()
    secret = settings.jwt_secret or "dev-insecure-change-me"
    expires = timedelta(minutes=settings.jwt_expires_minutes)
    payload = {
        "sub": subject,
        "exp": datetime.now(timezone.utc) + expires,
        "iat": datetime.now(timezone.utc),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, secret, algorithm="HS256")


def decode_access_token(token: str) -> dict:
    settings = get_settings()
    secret = settings.jwt_secret or "dev-insecure-change-me"
    return jwt.decode(token, secret, algorithms=["HS256"])
