import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.bootstrap import run_database_bootstrap
from app.config import get_settings
from app.database import check_db_connection, init_db, run_migrations
from app.health import build_health_payload

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
        from app.database import SessionLocal

        if SessionLocal is not None:
            with SessionLocal() as session:
                bootstrap_result = run_database_bootstrap(session, settings)
                logger.info("Database bootstrap result: %s", bootstrap_result)
    else:
        logger.warning("Database not reachable on startup — /health will report degraded")

    yield


app = FastAPI(title="SBL Backend", version="0.2.0", lifespan=lifespan)


@app.get("/health")
def health():
    payload = build_health_payload(detailed=False)
    status_code = 200 if payload["status"] == "ok" else 503
    return JSONResponse(content=payload, status_code=status_code)


@app.get("/health/validate")
def health_validate():
    payload = build_health_payload(detailed=True)
    status_code = 200 if payload["status"] == "ok" else 503
    return JSONResponse(content=payload, status_code=status_code)


if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="frontend")
