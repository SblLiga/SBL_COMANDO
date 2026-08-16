from datetime import datetime, timedelta, timezone

import jwt

from app.config import get_settings


def _jwt_secret() -> str:
    settings = get_settings()
    secret = (settings.jwt_secret or "").strip()
    if secret:
        return secret
    if settings.is_production:
        raise RuntimeError("JWT_SECRET is required in production")
    return "dev-insecure-change-me"


def create_access_token(subject: str, extra: dict | None = None) -> str:
    settings = get_settings()
    secret = _jwt_secret()
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
    secret = _jwt_secret()
    return jwt.decode(token, secret, algorithms=["HS256"])
