import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.entities import router as entities_router
from app.api.upload import router as upload_router
from app.auth.router import router as auth_router
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
            try:
                with SessionLocal() as session:
                    bootstrap_result = run_database_bootstrap(session, settings)
                    logger.info("Database bootstrap result: %s", bootstrap_result)
            except Exception:
                logger.exception("Database bootstrap failed")
    else:
        logger.warning("Database not reachable on startup — /health will report degraded")

    yield


app = FastAPI(title="SBL Backend", version="0.3.0", lifespan=lifespan)

settings = get_settings()
if not settings.is_production:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:8000",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(auth_router)
app.include_router(entities_router)
app.include_router(upload_router)

UPLOAD_DIR = Path("static/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


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
