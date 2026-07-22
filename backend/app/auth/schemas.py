from typing import Annotated

from pydantic import AfterValidator, BaseModel, Field


def _normalize_email(value: str) -> str:
    """Accept practical emails including DEV seed domains like *.local."""
    email = (value or "").strip().lower()
    if "@" not in email or " " in email:
        raise ValueError("Invalid email address")
    local, _, domain = email.partition("@")
    if not local or not domain or "." not in domain and not domain.endswith("local"):
        raise ValueError("Invalid email address")
    return email


EmailAddress = Annotated[str, AfterValidator(_normalize_email)]


class RegisterRequest(BaseModel):
    email: EmailAddress
    password: str = Field(min_length=6)


class LoginRequest(BaseModel):
    email: EmailAddress
    password: str


class VerifyOtpRequest(BaseModel):
    email: EmailAddress
    otpCode: str = Field(min_length=4, max_length=8)


class ResendOtpRequest(BaseModel):
    email: EmailAddress


class ResetPasswordRequest(BaseModel):
    email: EmailAddress


class ResetPasswordConfirm(BaseModel):
    resetToken: str
    newPassword: str = Field(min_length=6)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)


class UpdateMeRequest(BaseModel):
    full_name: str | None = None
    gender: str | None = None
    target: str | None = None
    onboarding_completed: bool | None = None
    group_id: str | None = None
    focus_target: str | None = None
    focus_month: str | None = None
    avatar_url: str | None = None
    subscription_status: str | None = None
    role: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
