from functools import lru_cache
from urllib.parse import quote_plus

from pydantic import Field, computed_field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _secret_json(secret_id: str) -> dict:
    """Load a JSON secret from AWS Secrets Manager (company source of truth)."""
    import json
    import os

    import boto3

    region = (
        os.environ.get("AWS_REGION")
        or os.environ.get("AWS_DEFAULT_REGION")
        or "us-east-1"
    )
    client = boto3.client("secretsmanager", region_name=region)
    raw = client.get_secret_value(SecretId=secret_id)["SecretString"]
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError(f"Secret {secret_id} must be a JSON object")
    return data


def _password_from_secrets_manager(secret_id: str) -> str:
    """Fetch DB password from Secrets Manager (avoids broken CFN ARN resolve)."""
    data = _secret_json(secret_id)
    password = data.get("password")
    if not password:
        raise ValueError(f"Secret {secret_id} has no 'password' field")
    return password


class Settings(BaseSettings):
    # env_file is optional local docker convenience only — cloud uses EB + Secrets Manager
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = Field(default="dev", alias="APP_ENV")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    port: int = Field(default=8000, alias="PORT")

    db_host: str = Field(default="localhost", alias="DB_HOST")
    db_port: int = Field(default=5432, alias="DB_PORT")
    db_name: str = Field(default="sbl_dev", alias="DB_NAME")
    db_user: str = Field(default="sbl_admin", alias="DB_USER")
    db_password: str = Field(default="", alias="DB_PASSWORD")
    db_secret_arn: str | None = Field(default=None, alias="DB_SECRET_ARN")
    db_sslmode: str = Field(default="prefer", alias="DB_SSLMODE")

    # App secrets JSON in Secrets Manager: jwt_secret, mail_from, grow_*, admin_*
    app_secret_arn: str | None = Field(default=None, alias="APP_SECRET_ARN")

    run_db_migrations: bool = Field(default=True, alias="RUN_DB_MIGRATIONS")
    seed_dev_data: bool | None = Field(default=None, alias="SEED_DEV_DATA")

    jwt_secret: str = Field(default="", alias="JWT_SECRET")
    jwt_expires_minutes: int = Field(default=60, alias="JWT_EXPIRES_MINUTES")

    admin_email: str = Field(default="", alias="ADMIN_EMAIL")
    admin_password: str = Field(default="", alias="ADMIN_PASSWORD")
    # DEV seed only — never use as a real secret store; override via APP_SECRET_ARN
    dev_admin_password: str = Field(default="Admin123!", alias="DEV_ADMIN_PASSWORD")

    mail_from: str = Field(default="", alias="MAIL_FROM")
    app_public_url: str = Field(default="", alias="APP_PUBLIC_URL")
    aws_region: str = Field(default="", alias="AWS_REGION")

    grow_webhook_secret: str = Field(default="", alias="GROW_WEBHOOK_SECRET")
    grow_payment_url: str = Field(
        default="https://grow.co.il/subscribe",
        alias="GROW_PAYMENT_URL",
    )
    # Make.com — outbound checkout trigger + inbound webhook auth (falls back to GROW_*)
    make_webhook_secret: str = Field(default="", alias="MAKE_WEBHOOK_SECRET")
    make_trigger_url: str = Field(default="", alias="MAKE_TRIGGER_URL")
    make_payment_url: str = Field(default="", alias="MAKE_PAYMENT_URL")

    @model_validator(mode="after")
    def hydrate_from_app_secret(self):
        """Overlay sensitive fields from Secrets Manager when APP_SECRET_ARN is set."""
        if not self.app_secret_arn:
            return self
        data = _secret_json(self.app_secret_arn)
        mapping = {
            "jwt_secret": ("jwt_secret", "JWT_SECRET"),
            "mail_from": ("mail_from", "MAIL_FROM"),
            "app_public_url": ("app_public_url", "APP_PUBLIC_URL"),
            "grow_webhook_secret": ("grow_webhook_secret", "GROW_WEBHOOK_SECRET"),
            "grow_payment_url": ("grow_payment_url", "GROW_PAYMENT_URL"),
            "make_webhook_secret": ("make_webhook_secret", "MAKE_WEBHOOK_SECRET"),
            "make_trigger_url": ("make_trigger_url", "MAKE_TRIGGER_URL"),
            "make_payment_url": ("make_payment_url", "MAKE_PAYMENT_URL"),
            "admin_email": ("admin_email", "ADMIN_EMAIL"),
            "admin_password": ("admin_password", "ADMIN_PASSWORD"),
            "dev_admin_password": ("dev_admin_password", "DEV_ADMIN_PASSWORD"),
        }
        updates = {}
        for attr, keys in mapping.items():
            for key in keys:
                if key in data and data[key] not in (None, ""):
                    updates[attr] = data[key]
                    break
        # Mutate in place — model_copy + Field(alias=...) can drop updates on some pydantic builds
        for attr, value in updates.items():
            object.__setattr__(self, attr, value)
        return self

    def resolved_db_password(self) -> str:
        if self.db_secret_arn:
            return _password_from_secrets_manager(self.db_secret_arn)
        return self.db_password

    @computed_field
    @property
    def database_url(self) -> str:
        user = quote_plus(self.db_user)
        password = quote_plus(self.resolved_db_password())
        return (
            f"postgresql+psycopg2://{user}:{password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
            f"?sslmode={self.db_sslmode}"
        )

    @computed_field
    @property
    def is_production(self) -> bool:
        return self.app_env.lower() in {"prod", "production"}

    @computed_field
    @property
    def seed_dev_data_enabled(self) -> bool:
        if self.is_production:
            return False
        if self.seed_dev_data is not None:
            return self.seed_dev_data
        return True


@lru_cache
def get_settings() -> Settings:
    return Settings()
