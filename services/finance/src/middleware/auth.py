"""
Authentication middleware for Finance Service
"""
import logging
from typing import Optional
from fastapi import Request, Response, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from jose import JWTError, jwt
import httpx

logger = logging.getLogger(__name__)


class AuthenticationMiddleware(BaseHTTPMiddleware):
    """
    Authentication middleware for Finance Service
    Validates JWT tokens and extracts user information
    """

    def __init__(self, app, skip_paths: list = None, jwt_secret: str = None, jwt_algorithm: str = None):
        super().__init__(app)
        self.skip_paths = skip_paths or []
        self.jwt_secret = jwt_secret
        self.jwt_algorithm = jwt_algorithm or "HS256"

    async def dispatch(self, request: Request, call_next):
        """
        Process request through authentication middleware
        """
        # Skip authentication for certain paths
        if request.url.path in self.skip_paths:
            return await call_next(request)

        # Get token from request
        token = self._extract_token(request)

        if not token:
            logger.warning(f"No token provided for request: {request.url.path}")
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                headers={"WWW-Authenticate": "Bearer"},
                content={"error": "Authentication required", "detail": "No token provided"}
            )

        # Validate token
        try:
            payload = self._validate_token(token)

            # Extract user information
            user_id = payload.get("sub")
            tenant_id = payload.get("tenant_id")
            user_role = payload.get("role")
            role_id = payload.get("role_id")
            permissions = payload.get("permissions", [])

            if not user_id or not tenant_id:
                logger.warning(f"Invalid token payload: {payload}")
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    headers={"WWW-Authenticate": "Bearer"},
                    content={"error": "Invalid token", "detail": "Missing required fields"}
                )

            # Add user info to request state
            request.state.user_id = user_id
            request.state.tenant_id = tenant_id
            request.state.user_role = user_role
            request.state.role_id = role_id
            request.state.permissions = permissions
            request.state.token_payload = payload

            logger.debug(f"Authenticated user: {user_id} for tenant: {tenant_id}")

        except JWTError as e:
            logger.error(f"JWT validation error: {str(e)}")
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                headers={"WWW-Authenticate": "Bearer"},
                content={"error": "Invalid token", "detail": "Token validation failed"}
            )
        except Exception as e:
            logger.error(f"Authentication error: {str(e)}")
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                headers={"WWW-Authenticate": "Bearer"},
                content={"error": "Authentication failed", "detail": "Token validation error"}
            )

        response = await call_next(request)
        return response

    def _extract_token(self, request: Request) -> Optional[str]:
        """Extract JWT token from request"""
        # Try Authorization header first
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            return auth_header[7:]  # Remove "Bearer " prefix

        # Try query parameter
        token = request.query_params.get("token")
        if token:
            return token

        # Try cookie
        token = request.cookies.get("access_token")
        if token:
            return token

        return None

    def _validate_token(self, token: str) -> dict:
        """Validate JWT token and return payload"""
        try:
            payload = jwt.decode(
                token,
                self.jwt_secret,
                algorithms=[self.jwt_algorithm]
            )
            return payload
        except jwt.ExpiredSignatureError:
            raise JWTError("Token has expired")
        except JWTError:
            raise JWTError("Invalid token")


class TokenData:
    """Token data class for dependency injection"""
    def __init__(self, user_id: str, tenant_id: str, permissions: list = None, role: str = None, role_id: int = None):
        self.user_id = user_id
        self.tenant_id = tenant_id
        self.permissions = permissions or []
        self.role = role
        self.role_id = role_id

    def is_super_user(self) -> bool:
        """Check if user has super user permissions"""
        return "super_user" in self.permissions or self.role == "super_admin"

    def has_permission(self, permission: str) -> bool:
        """Check if user has specific permission"""
        return permission in self.permissions or self.is_super_user()


class SecurityException(Exception):
    """Security exception for authentication/authorization errors"""
    pass


# Helper functions for dependency injection
def get_current_user_id(request: Request) -> str:
    """Get current user ID from request state"""
    return getattr(request.state, 'user_id', None)


def get_current_tenant_id(request: Request) -> str:
    """Get current tenant ID from request state"""
    return getattr(request.state, 'tenant_id', None)


def get_token_data(request: Request) -> TokenData:
    """Get token data from request state"""
    user_id = getattr(request.state, 'user_id', None)
    tenant_id = getattr(request.state, 'tenant_id', None)
    permissions = getattr(request.state, 'permissions', [])
    role = getattr(request.state, 'user_role', None)
    role_id = getattr(request.state, 'role_id', None)

    if not user_id or not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )

    return TokenData(user_id=user_id, tenant_id=tenant_id, permissions=permissions, role=role, role_id=role_id)