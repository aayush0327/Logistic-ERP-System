"""
Configuration settings for Finance Service
"""
import os
from pydantic_settings import BaseSettings
from typing import List


class FinanceSettings(BaseSettings):
    """Application settings"""

    # Application settings
    APP_NAME: str = "Finance Service"
    VERSION: str = "1.0.0"
    ENV: str = "development"
    DEBUG: bool = True
    LOG_LEVEL: str = "INFO"

    # Server settings
    service_host: str = "0.0.0.0"
    service_port: int = 8006

    # Database settings
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/logistics_erp"
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 30

    # Redis settings
    REDIS_URL: str = "redis://localhost:6379/1"

    # CORS settings
    allowed_origins: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://demo.logistics-erp.com",
    ]
    allowed_methods: List[str] = ["*"]
    allowed_headers: List[str] = ["*"]
    expose_headers: List[str] = []

    # Authentication settings - Using global configuration like other services
    GLOBAL_JWT_SECRET: str = os.getenv(
        "JWT_SECRET",
        "eyJhbGciOiJIUzI1NiJ9.eyJSb2xlIjoiQWRtaW4iLCJJc3N1ZXIiOiJJc3N1ZXIiLCJVc2VybmFtZSI6IkphdmFJblVzZSIsImV4cCI6MTc2NTY5MTkzMywiaWF0IjoxNzY1NjkxOTMzfQ.IR5TvLwqTpsCqR2gRa7ApNoTgfxPAjUh_LQ9JmgoXck"
    )
    GLOBAL_JWT_ALGORITHM: str = os.getenv("GLOBAL_JWT_ALGORITHM", "HS256")
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Orders Service settings
    ORDERS_SERVICE_URL: str = "http://orders-service:8003"
    ORDERS_SERVICE_TIMEOUT: int = 30

    # Auth Service settings
    AUTH_SERVICE_URL: str = os.getenv("AUTH_SERVICE_URL", "http://auth-service:8001")

    # Audit settings
    AUDIT_LOG_ENABLED: bool = True

    # Rate limiting settings
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW: int = 60

    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = FinanceSettings()