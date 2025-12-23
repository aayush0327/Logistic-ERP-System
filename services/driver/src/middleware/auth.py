"""
Authentication middleware for Driver Service - Based on TMS Service Implementation
"""
from typing import List, Optional
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import logging
import time

from src.security import (
    verify_token,
    extract_token_from_header,
    log_authentication_event,
)
from src.security.exceptions import (
    RateLimitExceededError,
    TokenExpiredError,
    TokenInvalidError,
)
from src.config import settings

logger = logging.getLogger(__name__)


class AuthenticationMiddleware(BaseHTTPMiddleware):
    """
    Middleware to handle JWT authentication for all requests
    """

    def __init__(self, app, skip_paths: List[str] = None):
        """
        Initialize authentication middleware

        Args:
            app: ASGI application
            skip_paths: List of paths to skip authentication
        """
        super().__init__(app)
        self.skip_paths = skip_paths or [
            "/health",
            "/ready",
            "/metrics",
            "/docs",
            "/openapi.json",
            "/redoc",
            "/favicon.ico",
            "/static",
        ]

    async def dispatch(self, request: Request, call_next):
        """
        Process request through authentication middleware

        Args:
            request: Incoming request
            call_next: Next middleware or route handler

        Returns:
            Response: HTTP response
        """
        path = request.url.path

        # Skip authentication for specified paths
        if any(path.startswith(skip_path) for skip_path in self.skip_paths):
            log_authentication_event("SKIPPED_AUTH", details=f"Path: {path}")
            response = await call_next(request)
            return response

        # Extract token from Authorization header
        auth_header = request.headers.get("authorization")
        if not auth_header:
            log_authentication_event("MISSING_TOKEN", details=f"Path: {path}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authorization header required"
            )

        # Extract token from "Bearer <token>" format
        token = extract_token_from_header(auth_header)
        if not token:
            log_authentication_event("INVALID_TOKEN_FORMAT", details=f"Path: {path}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authorization header format"
            )

        try:
            # Verify token
            token_data = verify_token(token)

            # Add user info to request state
            request.state.user_id = token_data.sub
            request.state.tenant_id = token_data.tenant_id
            request.state.permissions = token_data.permissions
            request.state.token_data = token_data

            log_authentication_event(
                "TOKEN_VALIDATED",
                user_id=token_data.sub,
                details=f"Tenant: {token_data.tenant_id}, Permissions: {len(token_data.permissions)}"
            )

        except TokenExpiredError as e:
            log_authentication_event("TOKEN_EXPIRED", details=f"Path: {path}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired"
            ) from e

        except TokenInvalidError as e:
            log_authentication_event("TOKEN_INVALID", details=f"Path: {path}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            ) from e

        except RateLimitExceededError as e:
            log_authentication_event("RATE_LIMIT_EXCEEDED", details=f"Path: {path}")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded"
            ) from e

        except Exception as e:
            log_authentication_event(
                "AUTH_ERROR",
                details=f"Path: {path}, Error: {str(e)}"
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Authentication error"
            ) from e

        # Process request
        response = await call_next(request)
        return response