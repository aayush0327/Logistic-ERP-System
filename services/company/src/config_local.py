"""
Local configuration for Company Service
"""
from typing import Optional, List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class CompanySettings(BaseSettings):
    """Company Service settings"""

    # Environment
    ENV: str = os.getenv("ENV", "development")
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    # Database
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "postgres")
    POSTGRES_HOST: str = os.getenv("POSTGRES_HOST", "postgres")
    POSTGRES_PORT: int = int(os.getenv("POSTGRES_PORT", "5432"))

    # Service databases
    POSTGRES_COMPANY_DB: str = os.getenv("POSTGRES_COMPANY_DB", "company_db")

    def get_database_url(self, db_name: str) -> str:
        """Get database URL for specific database"""
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@"
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

    # Service port
    PORT: int = int(os.getenv("PORT", "8002"))

    class Config:
        case_sensitive = True


@lru_cache()
def get_settings() -> CompanySettings:
    """Get cached settings"""
    return CompanySettings()


# Global settings instance
settings = get_settings()