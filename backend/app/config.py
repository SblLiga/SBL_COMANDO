import os
from functools import lru_cache

from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


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

    @computed_field
    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg2://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
            f"?sslmode={self.db_sslmode}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
