# Notification Service Configuration
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from typing import List
import os


class Settings(BaseSettings):
    """Application settings"""

    # Application
    APP_NAME: str = "Notification Service"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False
    ENV: str = "development"

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8007

    # Database
    DATABASE_URL: str

    # Redis
    REDIS_URL: str

    # Kafka
    KAFKA_BOOTSTRAP_SERVERS: str = "kafka:29092"
    KAFKA_NOTIFICATIONS_TOPIC: str = "notifications"

    # Auth Service
    AUTH_SERVICE_URL: str = "http://auth-service:8001"

    # Orders Service
    ORDERS_SERVICE_URL: str = "http://orders-service:8003"

    # JWT - Use the same GLOBAL_JWT_SECRET as other services
    JWT_SECRET: str = os.getenv(
        "GLOBAL_JWT_SECRET",
        "eyJhbGciOiJIUzI1NiJ9.eyJSb2xlIjoiQWRtaW4iLCJJc3N1ZXIiOiJJc3N1ZXIiLCJVc2VybmFtZSI6IkphdmFJblVzZSIsImV4cCI6MTc2NTY5MTkzMywiaWF0IjoxNzY1NjkxOTMzfQ.IR5TvLwqTpsCqR2gRa7ApNoTgfxPAjUh_LQ9JmgoXck"
    )

    # CORS - Handle as string for env var parsing
    @property
    def CORS_ORIGINS(self) -> List[str]:
        """Parse CORS_ORIGINS from environment"""
        cors_origins = os.getenv("CORS_ORIGINS", "*")
        if cors_origins == "*":
            return ["*"]
        return [origin.strip() for origin in cors_origins.split(",")]

    # SSE
    SSE_HEARTBEAT_INTERVAL: int = 30  # seconds

    # Scheduler
    SCHEDULER_ENABLED: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"
    )


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()
