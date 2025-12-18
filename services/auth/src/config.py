"""
Configuration for Authentication Service
"""
from typing import Optional
import sys
import os

# Add the parent directory to the path to import shared config
sys.path.append(os.path.join(os.path.dirname(__file__), '../../../../..'))

from config.settings import Settings
from shared.logging import LoggingMixin


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