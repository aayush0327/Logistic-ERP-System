"""Configuration settings for Driver Service."""

import os
from typing import Optional, List
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings."""

    # Service Configuration
    SERVICE_NAME: str = "driver-service"
    VERSION: str = "1.0.0"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # API Configuration
    API_V1_STR: str = "/api/v1"
    PORT: int = 8005
    HOST: str = "0.0.0.0"

    # TMS Service Configuration
    TMS_API_URL: str = os.getenv("TMS_API_URL", "http://tms-service:8004")
    TMS_API_TIMEOUT: int = int(os.getenv("TMS_API_TIMEOUT", "30"))

    # Redis Configuration
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379")

    # Driver Configuration
    DRIVER_ID: str = os.getenv("DRIVER_ID", "DRV-002")  # Hardcoded driver ID as per requirements

    # CORS Configuration
    @property
    def CORS_ORIGINS(self) -> List[str]:
        """Get CORS origins from environment or return defaults."""
        cors_origins_env = os.getenv("CORS_ORIGINS")
        if cors_origins_env:
            # Split comma-separated origins and filter out empty strings
            return [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]
        # Return default origins
        return [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://frontend:3000",
        ]

    # JWT Configuration
    JWT_SECRET: str = os.getenv(
        "JWT_SECRET",
        "eyJhbGciOiJIUzI1NiJ9.eyJSb2xlIjoiQWRtaW4iLCJJc3N1ZXIiOiJJc3N1ZXIiLCJVc2VybmFtZSI6IkphdmFJblVzZSIsImV4cCI6MTc2NTY5MTkzMywiaWF0IjoxNzY1NjkxOTMzfQ.IR5TvLwqTpsCqR2gRa7ApNoTgfxPAjUh_LQ9JmgoXck"
    )
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Kafka Configuration
    KAFKA_BOOTSTRAP_SERVERS: str = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "kafka:29092")

  
    class Config:
        """Pydantic configuration."""
        env_file = ".env"
        case_sensitive = True


# Create global settings instance
settings = Settings()