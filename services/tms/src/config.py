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
    allowed_methods: list[str] = ["GET", "POST",
                                  "PUT", "DELETE", "PATCH", "OPTIONS"]
    allowed_headers: list[str] = ["*"]
    expose_headers: list[str] = ["X-Total-Count", "X-Page-Count"]

    # Logging
    log_level: str = "INFO"
    enable_audit_logs: bool = True
    enable_performance_logs: bool = False

    # Service
    service_name: str = "tms-service"
    service_version: str = "0.1.0"
    service_host: str = "0.0.0.0"
    service_port: int = 8004

    # Security
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 1440  # 24 hours

    # Global JWT settings (shared across services)
    GLOBAL_JWT_SECRET: str = "eyJhbGciOiJIUzI1NiJ9.eyJSb2xlIjoiQWRtaW4iLCJJc3N1ZXIiOiJJc3N1ZXIiLCJVc2VybmFtZSI6IkphdmFJblVzZSIsImV4cCI6MTc2NTY5MTkzMywiaWF0IjoxNzY1NjkxOTMzfQ.IR5TvLwqTpsCqR2gRa7ApNoTgfxPAjUh_LQ9JmgoXck"
    GLOBAL_JWT_ALGORITHM: str = "HS256"

    # Rate limiting
    enable_rate_limiting: bool = True
    rate_limit_requests_per_minute: int = 60
    rate_limit_requests_per_hour: int = 1000

    # Security
    enable_security_headers: bool = True
    enable_audit_trail: bool = True

    # Pagination
    default_page_size: int = 20
    max_page_size: int = 100

    # Timeout settings
    request_timeout: int = 30
    database_connect_timeout: int = 10

    # Auth Service URL
    AUTH_SERVICE_URL: str = "http://auth-service:8001"

    # Orders Service URL
    ORDERS_SERVICE_URL: str = "http://orders-service:8003"

    class Config:
        env_file = ".env"
        case_sensitive = False


# Create global settings instance
settings = Settings()
