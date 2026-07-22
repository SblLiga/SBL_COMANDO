import time

from sqlalchemy import func, select, text

from app import database
from app.config import Settings, get_settings
from app.models import Goal, Group, User


def _database_status() -> dict:
    if database.engine is None:
        return {
            "connected": False,
            "responsive": False,
            "latency_ms": None,
            "error": "database engine is not initialized",
        }

    started = time.perf_counter()
    try:
        with database.engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        latency_ms = round((time.perf_counter() - started) * 1000, 2)
        return {
            "connected": True,
            "responsive": True,
            "latency_ms": latency_ms,
            "error": None,
        }
    except Exception as exc:
        return {
            "connected": False,
            "responsive": False,
            "latency_ms": None,
            "error": str(exc),
        }


def _bootstrap_status() -> dict:
    if database.SessionLocal is None:
        return {
            "users": 0,
            "admins": 0,
            "groups": 0,
            "goals": 0,
        }

    with database.SessionLocal() as session:
        return {
            "users": session.scalar(select(func.count()).select_from(User)) or 0,
            "admins": session.scalar(
                select(func.count()).select_from(User).where(User.role == "admin")
            )
            or 0,
            "groups": session.scalar(select(func.count()).select_from(Group)) or 0,
            "goals": session.scalar(select(func.count()).select_from(Goal)) or 0,
        }


def build_health_payload(settings: Settings | None = None, detailed: bool = False) -> dict:
    settings = settings or get_settings()
    db_status = _database_status()
    healthy = db_status["connected"] and db_status["responsive"]

    payload = {
        "status": "ok" if healthy else "degraded",
        "environment": settings.app_env,
        "mode": "production" if settings.is_production else "development",
        "database": db_status,
        "bootstrap": {
            "seed_dev_data_enabled": settings.seed_dev_data_enabled,
        },
    }

    if detailed and healthy:
        try:
            payload["bootstrap"].update(_bootstrap_status())
        except Exception as exc:
            payload["bootstrap"]["error"] = str(exc)

    return payload
