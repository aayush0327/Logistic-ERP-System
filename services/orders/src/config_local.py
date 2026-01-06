"""
Local configuration for Orders Service
"""
from typing import Optional, List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class OrdersSettings(BaseSettings):
    """Orders Service settings"""

    # Environment
    ENV: str = os.getenv("ENV", "development")
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "DEBUG")

    # Database
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "postgres")
    POSTGRES_HOST: str = os.getenv("POSTGRES_HOST", "postgres")
    POSTGRES_PORT: int = int(os.getenv("POSTGRES_PORT", "5432"))

    # Service databases
    POSTGRES_ORDERS_DB: str = os.getenv("POSTGRES_ORDERS_DB", "orders_db")

    def get_database_url(self, db_name: str) -> str:
        """Get database URL for specific database"""
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@"
            f"{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{db_name}"
        )

    # Redis
    REDIS_HOST: str = os.getenv("REDIS_HOST", "redis")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_PASSWORD: Optional[str] = os.getenv("REDIS_PASSWORD")

    @property
    def REDIS_URL(self) -> str:
        """Construct Redis URL"""
        password_part = f":{self.REDIS_PASSWORD}@" if self.REDIS_PASSWORD else ""
        return f"redis://{password_part}{self.REDIS_HOST}:{self.REDIS_PORT}/0"

    # CORS
    CORS_ORIGINS: Union[List[str], str] = os.getenv("CORS_ORIGINS", "http://localhost:3000")

    @field_validator('CORS_ORIGINS', mode='before')
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            # Split string by commas and strip whitespace
            return [origin.strip() for origin in v.split(",")]
        return v

    # Auth Service
    AUTH_SERVICE_URL: str = os.getenv("AUTH_SERVICE_URL", "http://localhost:8001")

    # JWT Authentication - Using global configuration like company service
    GLOBAL_JWT_SECRET: str = os.getenv(
        "JWT_SECRET",
        "eyJhbGciOiJIUzI1NiJ9.eyJSb2xlIjoiQWRtaW4iLCJJc3N1ZXIiOiJJc3N1ZXIiLCJVc2VybmFtZSI6IkphdmFJblVzZSIsImV4cCI6MTc2NTY5MTkzMywiaWF0IjoxNzY1NjkxOTMzfQ.IR5TvLwqTpsCqR2gRa7ApNoTgfxPAjUh_LQ9JmgoXck"
    )
    GLOBAL_JWT_ALGORITHM: str = os.getenv("GLOBAL_JWT_ALGORITHM", "HS256")
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "1440")  # 24 hours
    )
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = int(
        os.getenv("JWT_REFRESH_TOKEN_EXPIRE_DAYS", "7")
    )

    # Security Settings
    ALLOW_ORIGINS: Union[List[str], str] = os.getenv(
        "ALLOW_ORIGINS",
        "http://localhost:3000,http://localhost:8000"
    )
    ALLOW_METHODS: List[str] = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    ALLOW_HEADERS: List[str] = ["*"]
    ALLOW_CREDENTIALS: bool = True

    @field_validator('ALLOW_ORIGINS', mode='before')
    @classmethod
    def parse_allow_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = os.getenv("RATE_LIMIT_ENABLED", "true").lower() == "true"
    RATE_LIMIT_REQUESTS_PER_MINUTE: int = int(
        os.getenv("RATE_LIMIT_REQUESTS_PER_MINUTE", "300")  # Increased from 60 to 300 for inter-service calls
    )
    RATE_LIMIT_REQUESTS_PER_HOUR: int = int(
        os.getenv("RATE_LIMIT_REQUESTS_PER_HOUR", "10000")  # Increased from 1000 to 10000
    )

    # Security Headers
    SECURITY_ENABLE_CORS: bool = os.getenv("SECURITY_ENABLE_CORS", "true").lower() == "true"
    SECURITY_ENABLE_TRUSTED_HOST: bool = os.getenv(
        "SECURITY_ENABLE_TRUSTED_HOST", "false"
    ).lower() == "true"
    TRUSTED_HOSTS: Union[List[str], str] = os.getenv(
        "TRUSTED_HOSTS",
        "localhost,127.0.0.1"
    )

    @field_validator('TRUSTED_HOSTS', mode='before')
    @classmethod
    def parse_trusted_hosts(cls, v):
        if isinstance(v, str):
            return [host.strip() for host in v.split(",")]
        return v

    # Audit Logging
    AUDIT_LOG_ENABLED: bool = os.getenv("AUDIT_LOG_ENABLED", "true").lower() == "true"
    AUDIT_LOG_LEVEL: str = os.getenv("AUDIT_LOG_LEVEL", "INFO")

    # File upload settings
    MAX_FILE_SIZE: int = int(os.getenv("MAX_FILE_SIZE", "10485760"))  # 10MB
    ALLOWED_FILE_TYPES: List[str] = [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/jpg",
        "image/gif",
        "image/webp",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ]
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "uploads")

    # MinIO S3 settings
    MINIO_ENDPOINT: str = os.getenv("MINIO_ENDPOINT", "minio:9000")
    MINIO_PUBLIC_ENDPOINT: str = os.getenv("MINIO_PUBLIC_ENDPOINT", "localhost:9000")
    MINIO_ROOT_USER: str = os.getenv("MINIO_ROOT_USER", "minioadmin")
    MINIO_ROOT_PASSWORD: str = os.getenv("MINIO_ROOT_PASSWORD", "minioadmin")
    MINIO_SECURE: bool = os.getenv("MINIO_SECURE", "false").lower() == "true"
    MINIO_BUCKET: str = os.getenv("MINIO_BUCKET", "order-documents")

    # Service port
    PORT: int = int(os.getenv("PORT", "8003"))  # Changed to avoid conflict


@lru_cache()
def get_settings() -> OrdersSettings:
    """Get cached settings"""
    return OrdersSettings()


# Global settings instance
settings = get_settings()
