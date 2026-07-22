import logging
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.deps import get_current_user
from app.auth.jwt import create_access_token
from app.auth.schemas import (
    ChangePasswordRequest,
    LoginRequest,
    RegisterRequest,
    ResendOtpRequest,
    ResetPasswordConfirm,
    ResetPasswordRequest,
    TokenResponse,
    UpdateMeRequest,
    VerifyOtpRequest,
)
from app.config import get_settings
from app.database import get_db
from app.models import EmailVerificationToken, PasswordResetToken, User
from app.security import hash_password, verify_password
from app.serializers import user_to_dict

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])


def _issue_otp(db: Session, user: User) -> str:
    code = f"{secrets.randbelow(1_000_000):06d}"
    expires = datetime.now(timezone.utc) + timedelta(minutes=15)
    db.query(EmailVerificationToken).filter(
        EmailVerificationToken.user_id == user.id
    ).delete()
    db.add(EmailVerificationToken(user_id=user.id, code=code, expires_at=expires))
    db.commit()
    logger.info("OTP issued for %s", user.email)
    return code


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    existing = db.scalar(select(User).where(User.email == email))
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        full_name=email.split("@")[0],
        role="user",
        subscription_status="active",
        email_verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    _issue_otp(db, user)
    return {"message": "Verification code sent", "email": email}


@router.post("/verify-otp", response_model=TokenResponse)
def verify_otp(payload: VerifyOtpRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        raise HTTPException(status_code=400, detail="Invalid verification code")

    token_row = db.scalar(
        select(EmailVerificationToken)
        .where(EmailVerificationToken.user_id == user.id)
        .order_by(EmailVerificationToken.created_at.desc())
    )
    settings = get_settings()
    dev_bypass = not settings.is_production and payload.otpCode == "000000"

    if not dev_bypass:
        if token_row is None or token_row.code != payload.otpCode:
            raise HTTPException(status_code=400, detail="Invalid verification code")
        if token_row.expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Verification code expired")

    user.email_verified = True
    db.commit()
    access_token = create_access_token(str(user.id))
    return TokenResponse(access_token=access_token)


@router.post("/resend-otp")
def resend_otp(payload: ResendOtpRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        return {"message": "If the email exists, a new code was sent"}
    _issue_otp(db, user)
    return {"message": "Verification code sent"}


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.email_verified:
        raise HTTPException(status_code=403, detail="Email not verified")

    access_token = create_access_token(str(user.id))
    return TokenResponse(access_token=access_token)


@router.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return user_to_dict(current_user)


@router.patch("/me")
def update_me(
    payload: UpdateMeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = payload.model_dump(exclude_unset=True)
    if "group_id" in data and data["group_id"] is not None:
        data["group_id"] = int(data["group_id"])
    for key, value in data.items():
        setattr(current_user, key, value)
    db.commit()
    db.refresh(current_user)
    return user_to_dict(current_user)


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password updated"}


@router.post("/reset-password-request")
def reset_password_request(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        return {"message": "If the email exists, reset instructions were sent"}

    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(hours=1)
    db.add(PasswordResetToken(user_id=user.id, token=token, expires_at=expires))
    db.commit()
    settings = get_settings()
    response: dict[str, str] = {"message": "If the email exists, reset instructions were sent"}
    if not settings.is_production:
        logger.info("Password reset token issued for %s", email)
        response["reset_token"] = token
    return response


@router.post("/reset-password")
def reset_password(payload: ResetPasswordConfirm, db: Session = Depends(get_db)):
    row = db.scalar(
        select(PasswordResetToken).where(PasswordResetToken.token == payload.resetToken)
    )
    if row is None or row.used or row.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    user = db.get(User, row.user_id)
    if user is None:
        raise HTTPException(status_code=400, detail="Invalid reset token")

    user.password_hash = hash_password(payload.newPassword)
    row.used = True
    db.commit()
    return {"message": "Password reset successful"}


@router.post("/logout")
def logout():
    return {"message": "Logged out"}
