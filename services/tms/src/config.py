"""Configuration settings for TMS Service"""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings"""

    # Database
    database_url: str = "postgresql+asyncpg://postgres:password@localhost:5432/tms_db"

    # API
    api_v1_prefix: str = "/api/v1"

    # CORS
    allowed_origins: list[str] = ["*"]

    # Logging
    log_level: str = "INFO"

    # Service
    service_name: str = "tms-service"
    service_version: str = "0.1.0"

    class Config:
        env_file = ".env"
        case_sensitive = False


# Create global settings instance
settings = Settings()