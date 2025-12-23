"""
Tenant-related middleware for Orders Service
"""
from contextvars import ContextVar
from typing import Optional, Callable
import uuid
import logging
from fastapi import Request, Response, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from src.security.auth import verify_token, extract_token_from_header
from src.security import TokenData

logger = logging.getLogger(__name__)

# Context variables for tenant and user information
current_tenant: ContextVar[Optional[str]] = ContextVar('current_tenant', default=None)
current_user: ContextVar[Optional[str]] = ContextVar('current_user', default=None)
current_permissions: ContextVar[Optional[list]] = ContextVar('current_permissions', default=None)


class TenantContextMiddleware(BaseHTTPMiddleware):
    """
    Middleware to extract tenant and user context from JWT token
    and store it in request context for downstream use
    """

    def __init__(self, app, require_authentication: bool = True):
        super().__init__(app)
        self.require_authentication = require_authentication

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Extract tenant and user information from JWT token

        Args:
            request: Incoming HTTP request
            call_next: Next middleware in chain

        Returns:
            HTTP response with tenant context
        """
        # Paths that don't require authentication
        public_paths = [
            "/health",
            "/ready",
            "/metrics",
            "/docs",
            "/redoc",
            "/openapi.json"
        ]

        # Skip authentication for public paths
        if request.url.path in public_paths:
            return await call_next(request)

        try:
            # Extract authorization header
            authorization = request.headers.get("authorization")

            if not authorization:
                if self.require_authentication:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Authorization header missing",
                        headers={"WWW-Authenticate": "Bearer"},
                    )
                else:
                    # Continue without authentication if not required
                    return await call_next(request)

            # Extract and verify token
            token = extract_token_from_header(authorization)
            token_data = verify_token(token)

            # Store tenant and user information in context
            current_tenant.set(token_data.tenant_id)
            current_user.set(token_data.user_id)
            current_permissions.set(token_data.permissions)

            # Add to request state for easy access
            request.state.tenant_id = token_data.tenant_id
            request.state.user_id = token_data.user_id
            request.state.permissions = token_data.permissions
            request.state.role_id = token_data.role_id
            request.state.token_data = token_data

            # Log tenant access for debugging
            logger.debug(f"Request from user {token_data.user_id} in tenant {token_data.tenant_id}")

        except HTTPException:
            # Re-raise HTTP exceptions
            raise
        except Exception as e:
            logger.error(f"Error in tenant context middleware: {str(e)}")
            if self.require_authentication:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid authentication",
                )
            # Continue without authentication if not required

        return await call_next(request)


class TenantIsolationMiddleware(BaseHTTPMiddleware):
    """
    Middleware to ensure tenant isolation by validating tenant access
    and adding tenant_id to database queries
    """

    def __init__(self, app):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Validate tenant access and ensure proper isolation

        Args:
            request: Incoming HTTP request
            call_next: Next middleware in chain

        Returns:
            HTTP response with tenant isolation
        """
        # Skip for non-API routes
        if not request.url.path.startswith("/api/"):
            return await call_next(request)

        # Get tenant from context or request state
        tenant_id = getattr(request.state, 'tenant_id', None)
        user_id = getattr(request.state, 'user_id', None)
        permissions = getattr(request.state, 'permissions', [])

        # If no tenant context, continue without tenant isolation
        # The individual endpoints will handle authorization
        if not tenant_id:
            logger.debug("No tenant context found, continuing without isolation")
            return await call_next(request)

        # Validate tenant header (optional - for additional security)
        request_tenant_id = request.headers.get("x-tenant-id")
        if request_tenant_id and request_tenant_id != tenant_id:
            logger.warning(f"Tenant mismatch: header={request_tenant_id}, token={tenant_id}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tenant access denied"
            )

        # Add tenant validation to request state
        request.state.validated_tenant_id = tenant_id

        # Log tenant access for audit purposes
        logger.info(
            f"API access: user={user_id}, tenant={tenant_id}, "
            f"path={request.url.path}, method={request.method}"
        )

        return await call_next(request)


def get_current_tenant_id() -> Optional[str]:
    """
    Get current tenant ID from context

    Returns:
        Tenant ID if available, None otherwise
    """
    return current_tenant.get()


def get_current_user_id() -> Optional[str]:
    """
    Get current user ID from context

    Returns:
        User ID if available, None otherwise
    """
    return current_user.get()


def get_current_permissions() -> list:
    """
    Get current user permissions from context

    Returns:
        List of permissions
    """
    return current_permissions.get() or []


class TenantHeaderMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add tenant information to response headers
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Add tenant information to response headers

        Args:
            request: Incoming HTTP request
            call_next: Next middleware in chain

        Returns:
            HTTP response with tenant headers
        """
        response = await call_next(request)

        # Add tenant information to response headers (if available)
        tenant_id = getattr(request.state, 'tenant_id', None)
        if tenant_id:
            response.headers["x-tenant-id"] = tenant_id

        return response