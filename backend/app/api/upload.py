import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.database import get_db
from app.media_urls import sync_avatar_to_members
from app.models import MediaAsset, User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["uploads"])

# Local disk mirror (optional cache). Source of truth is media_assets in DB.
UPLOAD_DIR = (Path.cwd() / "static" / "uploads").resolve()
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"}
MAX_BYTES = 5 * 1024 * 1024  # 5MB


def _suffix_for(file: UploadFile) -> str:
    suffix = (Path(file.filename or "upload.bin").suffix or "").lower()
    content_type = (file.content_type or "").lower()
    if suffix in ALLOWED_SUFFIXES:
        return suffix
    return {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
        "image/heic": ".heic",
        "image/heif": ".heif",
    }.get(content_type, ".jpg")


@router.post("/integrations/core/upload-file")
async def upload_file(
    file: UploadFile = File(...),
    purpose: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    suffix = (Path(file.filename or "upload.bin").suffix or "").lower()
    content_type = (file.content_type or "").lower() or "application/octet-stream"

    if suffix not in ALLOWED_SUFFIXES and not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image uploads are allowed")

    suffix = _suffix_for(file)
    if not content_type.startswith("image/"):
        content_type = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp",
            ".gif": "image/gif",
            ".heic": "image/heic",
            ".heif": "image/heif",
        }.get(suffix, "image/jpeg")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(content) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="Image must be under 5MB")

    media_id = uuid.uuid4().hex
    asset = MediaAsset(
        id=media_id,
        content_type=content_type,
        filename=file.filename or f"{media_id}{suffix}",
        content=content,
        byte_size=len(content),
        owner_user_id=user.id,
    )
    db.add(asset)

    # Best-effort local cache for same-instance StaticFiles (/uploads/...)
    try:
        (UPLOAD_DIR / f"{media_id}{suffix}").write_bytes(content)
    except OSError:
        logger.warning("Could not mirror upload to disk cache", exc_info=True)

    # Public (unguessable id) — <img src> cannot send Authorization headers
    url = f"/api/media/{media_id}"

    # Avatar uploads: sync User + Member so League/Manager/HQ all see the photo
    if (purpose or "").strip().lower() in {"avatar", "profile", "profile_avatar"}:
        user.avatar_url = url
        sync_avatar_to_members(db, user, url)

    db.commit()

    logger.info(
        "Upload saved user=%s media_id=%s bytes=%s content_type=%s purpose=%s",
        user.id,
        media_id,
        len(content),
        content_type,
        purpose,
    )
    return {"file_url": url, "url": url, "media_id": media_id}


@router.get("/media/{media_id}")
def get_media(media_id: str, db: Session = Depends(get_db)):
    """Serve durable media for avatars/rewards. No auth — UUID is the access key."""
    if not media_id or len(media_id) > 32 or not media_id.isalnum():
        raise HTTPException(status_code=404, detail="Not found")
    asset = db.get(MediaAsset, media_id)
    if asset is None:
        raise HTTPException(status_code=404, detail="Not found")
    return Response(
        content=asset.content,
        media_type=asset.content_type or "application/octet-stream",
        headers={
            "Cache-Control": "public, max-age=31536000, immutable",
            "Content-Disposition": f'inline; filename="{asset.filename or media_id}"',
        },
    )
