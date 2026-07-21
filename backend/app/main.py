import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.database import check_db_connection, init_db, run_migrations

logger = logging.getLogger(__name__)
STATIC_DIR = Path("static/frontend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logging.basicConfig(level=settings.log_level.upper())

    init_db(settings)

    if settings.run_db_migrations:
        try:
            run_migrations()
            logger.info("Database migrations completed")
        except Exception:
            logger.exception("Database migrations failed")

    if check_db_connection():
        logger.info("Database connection verified on startup")
    else:
        logger.warning("Database not reachable on startup — /health will report degraded")

    yield


app = FastAPI(title="SBL Backend", version="0.1.0", lifespan=lifespan)


@app.get("/health")
def health():
    db_connected = check_db_connection()
    payload = {
        "status": "ok" if db_connected else "degraded",
        "database": "connected" if db_connected else "disconnected",
        "environment": get_settings().app_env,
    }
    status_code = 200 if db_connected else 503
    return JSONResponse(content=payload, status_code=status_code)


if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="frontend")
