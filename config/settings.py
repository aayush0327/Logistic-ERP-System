"""
Application settings configuration
"""
import os
from typing import List, Optional
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings"""

    # Environment
    ENV: str = os.getenv("ENV", "development")
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    # Database
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "postgres")
    POSTGRES_HOST: str = os.getenv("POSTGRES_HOST", "localhost")
    POSTGRES_PORT: int = int(os.getenv("POSTGRES_PORT", "5432"))

    # Service databases
    POSTGRES_AUTH_DB: str = os.getenv("POSTGRES_AUTH_DB", "auth_db")
    POSTGRES_ORDERS_DB: str = os.getenv("POSTGRES_ORDERS_DB", "orders_db")
    POSTGRES_WMS_DB: str = os.getenv("POSTGRES_WMS_DB", "wms_db")
    POSTGRES_TMS_DB: str = os.getenv("POSTGRES_TMS_DB", "tms_db")
    POSTGRES_BILLING_DB: str = os.getenv("POSTGRES_BILLING_DB", "billing_db")
    POSTGRES_TELEMETRY_DB: str = os.getenv("POSTGRES_TELEMETRY_DB", "telemetry_db")

    # Redis
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_PASSWORD: Optional[str] = os.getenv("REDIS_PASSWORD")
    REDIS_DB: int = int(os.getenv("REDIS_DB", "0"))

    @property
    def REDIS_URL(self) -> str:
        """Construct Redis URL"""
        password_part = f":{self.REDIS_PASSWORD}@" if self.REDIS_PASSWORD else ""
        return f"redis://{password_part}{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    # Kafka
    KAFKA_BOOTSTRAP_SERVERS: str = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
    KAFKA_GROUP_ID: str = os.getenv("KAFKA_GROUP_ID", "logistics-erp")

    # Elasticsearch
    ELASTICSEARCH_HOST: str = os.getenv("ELASTICSEARCH_HOST", "localhost")
    ELASTICSEARCH_PORT: int = int(os.getenv("ELASTICSEARCH_PORT", "9200"))
    ELASTICSEARCH_USERNAME: Optional[str] = os.getenv("ELASTICSEARCH_USERNAME")
    ELASTICSEARCH_PASSWORD: Optional[str] = os.getenv("ELASTICSEARCH_PASSWORD")
    ELASTICSEARCH_INDEX_PREFIX: str = os.getenv("ELASTICSEARCH_INDEX_PREFIX", "logistics")

    @property
    def ELASTICSEARCH_URL(self) -> str:
        """Construct Elasticsearch URL"""
        auth_part = ""
        if self.ELASTICSEARCH_USERNAME and self.ELASTICSEARCH_PASSWORD:
            auth_part = f"{self.ELASTICSEARCH_USERNAME}:{self.ELASTICSEARCH_PASSWORD}@"
        return f"http://{auth_part}{self.ELASTICSEARCH_HOST}:{self.ELASTICSEARCH_PORT}"

    # MinIO
    MINIO_ENDPOINT: str = os.getenv("MINIO_ENDPOINT", "localhost:9000")
    MINIO_ACCESS_KEY: str = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    MINIO_SECRET_KEY: str = os.getenv("MINIO_SECRET_KEY", "minioadmin")
    MINIO_SECURE: bool = os.getenv("MINIO_SECURE", "false").lower() == "true"
    MINIO_BUCKET_NAME: str = os.getenv("MINIO_BUCKET_NAME", "logistics-documents")

    # JWT
    JWT_SECRET: str = os.getenv("JWT_SECRET", "your-secret-key")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))  # 24 hours

    # OIDC
    OIDC_CLIENT_ID: str = os.getenv("OIDC_CLIENT_ID", "")
    OIDC_CLIENT_SECRET: str = os.getenv("OIDC_CLIENT_SECRET", "")
    OIDC_ISSUER_URL: str = os.getenv("OIDC_ISSUER_URL", "")

    # Email
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_TLS: bool = os.getenv("SMTP_TLS", "true").lower() == "true"

    # File Upload
    MAX_FILE_SIZE_MB: int = int(os.getenv("MAX_FILE_SIZE_MB", "10"))
    ALLOWED_FILE_TYPES: List[str] = os.getenv("ALLOWED_FILE_TYPES", "pdf,doc,docx,xls,xlsx,jpg,jpeg,png").split(",")

    # Rate Limiting
    RATE_LIMIT_REQUESTS: int = int(os.getenv("RATE_LIMIT_REQUESTS", "100"))
    RATE_LIMIT_WINDOW: int = int(os.getenv("RATE_LIMIT_WINDOW", "60"))

    # CORS
    CORS_ORIGINS: List[str] = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

    # Encryption
    ENCRYPTION_KEY: str = os.getenv("ENCRYPTION_KEY", "your-32-character-encryption-key")

    # TimescaleDB
    TIMESCALEDB_HOST: str = os.getenv("TIMESCALEDB_HOST", "localhost")
    TIMESCALEDB_PORT: int = int(os.getenv("TIMESCALEDB_PORT", "5437"))

    @property
    def TIMESCALEDB_URL(self) -> str:
        """Construct TimescaleDB URL"""
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@"
            f"{self.TIMESCALEDB_HOST}:{self.TIMESCALEDB_PORT}/{self.POSTGRES_TELEMETRY_DB}"
        )

    @property
    def get_database_url(self, db_name: str) -> str:
        """Get database URL for specific database"""
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@"
            f"{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{db_name}"
        )

    # API Configuration
    API_V1_PREFIX: str = "/api/v1"
    TITLE: str = "Logistics ERP API"
    DESCRIPTION: str = "Multi-tenant Logistics ERP System API"
    VERSION: str = "1.0.0"

    # Pagination
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100

    # Monitoring
    ENABLE_METRICS: bool = os.getenv("ENABLE_METRICS", "true").lower() == "true"
    ENABLE_TRACING: bool = os.getenv("ENABLE_TRACING", "true").lower() == "true"
    JAEGER_ENDPOINT: str = os.getenv("JAEGER_ENDPOINT", "http://localhost:14268/api/traces")

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()