import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, UploadFile

from app.auth.deps import get_current_user
from app.models import User

router = APIRouter(prefix="/api", tags=["uploads"])
UPLOAD_DIR = Path("static/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/integrations/core/upload-file")
async def upload_file(
    file: UploadFile = File(...),
    _user: User = Depends(get_current_user),
):
    suffix = Path(file.filename or "upload.bin").suffix or ".bin"
    name = f"{uuid.uuid4().hex}{suffix}"
    dest = UPLOAD_DIR / name
    content = await file.read()
    dest.write_bytes(content)
    return {"file_url": f"/uploads/{name}", "url": f"/uploads/{name}"}
