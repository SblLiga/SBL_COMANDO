import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.entities import router as entities_router
from app.api.grow_webhook import router as grow_router
from app.api.upload import router as upload_router
from app.auth.router import router as auth_router
from app.bootstrap import run_database_bootstrap
from app.config import get_settings
from app.database import check_db_connection, init_db, run_migrations
from app.health import build_health_payload

logger = logging.getLogger(__name__)
STATIC_DIR = Path("static/frontend")
ASSETS_DIR = STATIC_DIR / "assets"


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
app.include_router(grow_router)

UPLOAD_DIR = (Path.cwd() / "static" / "uploads").resolve()
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


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


def _spa_index() -> FileResponse:
    index = STATIC_DIR / "index.html"
    if not index.exists():
        raise HTTPException(status_code=404, detail="Frontend not built")
    return FileResponse(index)


if ASSETS_DIR.exists():
    app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="frontend-assets")


@app.get("/")
def spa_root():
    return _spa_index()


@app.get("/{full_path:path}")
def spa_fallback(full_path: str):
    """Serve the React SPA for client-side routes like /admin, /login, /manager."""
    # SPA fallback: never shadow API / health / uploads / GROW
    if full_path.startswith(("api/", "health", "uploads/", "docs", "openapi.json", "redoc")):
        raise HTTPException(status_code=404, detail="Not Found")

    # Prefer real static files (favicon, logo.svg, etc.)
    candidate = (STATIC_DIR / full_path).resolve()
    try:
        candidate.relative_to(STATIC_DIR.resolve())
    except ValueError:
        return _spa_index()
    if candidate.is_file():
        return FileResponse(candidate)

    return _spa_index()
