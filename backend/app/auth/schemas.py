from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    otpCode: str = Field(min_length=4, max_length=8)


class ResendOtpRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr


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
