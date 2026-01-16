"""
Configuration settings for Orders Service
"""
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings"""

    # Application settings
    APP_NAME: str = "Orders Service"
    VERSION: str = "1.0.0"
    ENV: str = "development"
    DEBUG: bool = True
    LOG_LEVEL: str = "INFO"

    # Server settings
    HOST: str = "0.0.0.0"
    PORT: int = 8002

    # Database settings
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/logistics_erp"
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 30

    # Redis settings
    REDIS_URL: str = "redis://localhost:6379/1"

    # CORS settings
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://demo.logistics-erp.com",
    ]

    # Authentication settings
    JWT_SECRET_KEY: str = "your-secret-key-here"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # File upload settings
    MAX_FILE_SIZE: int = 10 * 1024 * 1024  # 10MB
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
    UPLOAD_DIR: str = "uploads"

    # MinIO S3 settings
    MINIO_ENDPOINT: str = "minio:9000"
    MINIO_PUBLIC_ENDPOINT: str = "localhost:9000"
    MINIO_ROOT_USER: str = "minioadmin"
    MINIO_ROOT_PASSWORD: str = "minioadmin"
    MINIO_SECURE: bool = False
    MINIO_BUCKET: str = "order-documents"

    # External services
    AUTH_SERVICE_URL: str = "http://localhost:8001"
    CUSTOMER_SERVICE_URL: str = "http://localhost:8003"
    BRANCH_SERVICE_URL: str = "http://localhost:8004"
    PRODUCT_SERVICE_URL: str = "http://localhost:8005"

    # Kafka settings
    KAFKA_BOOTSTRAP_SERVERS: List[str] = ["kafka:29092"]
    KAFKA_TOPIC_ORDERS: str = "orders"
    KAFKA_TOPIC_ORDER_EVENTS: str = "order-events"

    # Monitoring
    ENABLE_METRICS: bool = True
    JAEGER_ENDPOINT: str = "http://localhost:14268/api/traces"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()