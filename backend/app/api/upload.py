import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.auth.deps import get_current_user
from app.models import User

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["uploads"])

# Absolute under CWD so EB write + StaticFiles mount always agree
UPLOAD_DIR = (Path.cwd() / "static" / "uploads").resolve()
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"}
MAX_BYTES = 5 * 1024 * 1024  # 5MB


@router.post("/integrations/core/upload-file")
async def upload_file(
    file: UploadFile = File(...),
    _user: User = Depends(get_current_user),
):
    suffix = (Path(file.filename or "upload.bin").suffix or "").lower()
    content_type = (file.content_type or "").lower()

    if suffix not in ALLOWED_SUFFIXES and not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image uploads are allowed")

    if suffix not in ALLOWED_SUFFIXES:
        suffix = {
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/webp": ".webp",
            "image/gif": ".gif",
            "image/heic": ".heic",
            "image/heif": ".heif",
        }.get(content_type, ".jpg")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(content) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="Image must be under 5MB")

    name = f"{uuid.uuid4().hex}{suffix}"
    dest = UPLOAD_DIR / name
    try:
        dest.write_bytes(content)
    except OSError as exc:
        logger.exception("Failed writing upload to %s", dest)
        raise HTTPException(status_code=500, detail="Could not save uploaded file") from exc

    url = f"/uploads/{name}"
    logger.info("Upload saved user=%s path=%s bytes=%s", _user.id, dest, len(content))
    return {"file_url": url, "url": url}
