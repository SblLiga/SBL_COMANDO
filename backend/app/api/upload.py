import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.auth.deps import get_current_user
from app.models import User

router = APIRouter(prefix="/api", tags=["uploads"])
UPLOAD_DIR = Path("static/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_BYTES = 5 * 1024 * 1024  # 5MB


@router.post("/integrations/core/upload-file")
async def upload_file(
    file: UploadFile = File(...),
    _user: User = Depends(get_current_user),
):
    suffix = (Path(file.filename or "upload.bin").suffix or ".bin").lower()
    content_type = (file.content_type or "").lower()

    if suffix not in ALLOWED_SUFFIXES and not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image uploads are allowed")

    if suffix not in ALLOWED_SUFFIXES:
        # Map content-type to extension when filename is missing/odd
        suffix = {
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/webp": ".webp",
            "image/gif": ".gif",
        }.get(content_type, ".jpg")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(content) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="Image must be under 5MB")

    name = f"{uuid.uuid4().hex}{suffix}"
    dest = UPLOAD_DIR / name
    dest.write_bytes(content)
    url = f"/uploads/{name}"
    return {"file_url": url, "url": url}
