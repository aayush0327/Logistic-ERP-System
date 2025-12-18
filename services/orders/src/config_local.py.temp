"""
Local configuration for Authentication Service (standalone)
"""
from typing import Optional, List
from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class Settings(BaseSettings):
    """Application settings"""

    # Environment
    ENV: str = os.getenv("ENV", "development")
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    # Database
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "postgres")
    POSTGRES_HOST: str = os.getenv("POSTGRES_HOST", "postgres_ERP")
    POSTGRES_PORT: int = int(os.getenv("POSTGRES_PORT", "5432"))

    # Service databases
    POSTGRES_AUTH_DB: str = os.getenv("POSTGRES_AUTH_DB", "auth_db")

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

    # JWT
    JWT_SECRET: str = os.getenv("JWT_SECRET", "your-super-secret-jwt-key-change-this-in-production")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))  # 24 hours

    # CORS
    CORS_ORIGINS: List[str] = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


class LoggingMixin:
    """Simple logging mixin for standalone auth service"""

    @property
    def logger(self):
        """Get simple logger"""
        import logging
        return logging.getLogger(self.__class__.__name__)

    def log_event(self, event: str, level: str = "info", **kwargs):
        """Log an event"""
        log_method = getattr(self.logger, level, self.logger.info)
        if kwargs:
            # Format kwargs into the message
            formatted_kwargs = ", ".join(f"{k}={v}" for k, v in kwargs.items())
            message = f"{event} - {formatted_kwargs}"
        else:
            message = event
        log_method(message)


class AuthSettings(Settings, LoggingMixin):
    """Extended settings for Auth Service"""

    # Auth specific settings
    PASSWORD_MIN_LENGTH: int = 8
    PASSWORD_REQUIRE_UPPERCASE: bool = True
    PASSWORD_REQUIRE_LOWERCASE: bool = True
    PASSWORD_REQUIRE_NUMBERS: bool = True
    PASSWORD_REQUIRE_SPECIAL: bool = True

    # Session settings
    SESSION_EXPIRE_MINUTES: int = 1440  # 24 hours
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days
    MAX_LOGIN_ATTEMPTS: int = 5
    LOCKOUT_DURATION_MINUTES: int = 30

    # OIDC settings
    OIDC_ENABLED: bool = os.getenv("OIDC_ENABLED", "false").lower() == "true"
    OIDC_TOKEN_ENDPOINT: Optional[str] = os.getenv("OIDC_TOKEN_ENDPOINT")
    OIDC_USERINFO_ENDPOINT: Optional[str] = os.getenv("OIDC_USERINFO_ENDPOINT")
    OIDC_JWKS_URI: Optional[str] = os.getenv("OIDC_JWKS_URI")

    @property
    def auth_database_url(self) -> str:
        """Get auth service database URL"""
        return self.get_database_url(self.POSTGRES_AUTH_DB)

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.log_event("Auth service configured", env=self.ENV)