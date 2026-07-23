from functools import lru_cache
from urllib.parse import quote_plus

from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


def _password_from_secrets_manager(secret_id: str) -> str:
    """Fetch DB password from Secrets Manager (avoids broken CFN ARN resolve)."""
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
    password = data.get("password")
    if not password:
        raise ValueError(f"Secret {secret_id} has no 'password' field")
    return password


class Settings(BaseSettings):
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

    run_db_migrations: bool = Field(default=True, alias="RUN_DB_MIGRATIONS")
    seed_dev_data: bool | None = Field(default=None, alias="SEED_DEV_DATA")

    jwt_secret: str = Field(default="", alias="JWT_SECRET")
    jwt_expires_minutes: int = Field(default=60, alias="JWT_EXPIRES_MINUTES")

    admin_email: str = Field(default="", alias="ADMIN_EMAIL")
    admin_password: str = Field(default="", alias="ADMIN_PASSWORD")
    dev_admin_password: str = Field(default="Admin123!", alias="DEV_ADMIN_PASSWORD")

    # Transactional email (Amazon SES). Empty MAIL_FROM = log-only fallback.
    mail_from: str = Field(default="", alias="MAIL_FROM")
    app_public_url: str = Field(default="", alias="APP_PUBLIC_URL")
    aws_region: str = Field(default="", alias="AWS_REGION")

    # GROW payments — wire secrets tomorrow morning
    grow_webhook_secret: str = Field(default="", alias="GROW_WEBHOOK_SECRET")
    grow_payment_url: str = Field(
        default="https://grow.co.il/subscribe",
        alias="GROW_PAYMENT_URL",
    )

    def resolved_db_password(self) -> str:
        # Prefer Secrets Manager when ARN/name is set. EB/CFN dynamic
        # references with full secret ARNs break on colons and inject a bad password.
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
