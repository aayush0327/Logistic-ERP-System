"""
Security-related exception handlers for Company Service
"""
from typing import Dict, Any
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import logging
import traceback
from datetime import datetime

from .auth import TokenData


logger = logging.getLogger(__name__)


class SecurityException(Exception):
    """Base security exception"""

    def __init__(
        self,
        message: str,
        error_code: str = None,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        details: Dict[str, Any] = None
    ):
        self.message = message
        self.error_code = error_code or "SECURITY_ERROR"
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


class AuthenticationError(SecurityException):
    """Authentication related errors"""

    def __init__(self, message: str, details: Dict[str, Any] = None):
        super().__init__(
            message=message,
            error_code="AUTHENTICATION_FAILED",
            status_code=status.HTTP_401_UNAUTHORIZED,
            details=details
        )


class AuthorizationError(SecurityException):
    """Authorization related errors"""

    def __init__(self, message: str, details: Dict[str, Any] = None):
        super().__init__(
            message=message,
            error_code="AUTHORIZATION_FAILED",
            status_code=status.HTTP_403_FORBIDDEN,
            details=details
        )


class TokenExpiredError(AuthenticationError):
    """Token expired error"""

    def __init__(self, details: Dict[str, Any] = None):
        super().__init__(
            message="Token has expired",
            details=details
        )


class TokenInvalidError(AuthenticationError):
    """Invalid token error"""

    def __init__(self, message: str = "Invalid token", details: Dict[str, Any] = None):
        super().__init__(
            message=message,
            details=details
        )


class PermissionDeniedError(AuthorizationError):
    """Permission denied error"""

    def __init__(
        self,
        required_permissions: list = None,
        user_permissions: list = None,
        details: Dict[str, Any] = None
    ):
        message = "Permission denied"
        if required_permissions:
            message += f". Required: {', '.join(required_permissions)}"

        all_details = {
            "required_permissions": required_permissions or [],
            "user_permissions": user_permissions or [],
        }
        if details:
            all_details.update(details)

        super().__init__(
            message=message,
            details=all_details
        )


class TenantAccessError(AuthorizationError):
    """Tenant access denied error"""

    def __init__(
        self,
        user_tenant_id: str = None,
        resource_tenant_id: str = None,
        details: Dict[str, Any] = None
    ):
        message = "Tenant access denied"
        if user_tenant_id and resource_tenant_id:
            message += f". User tenant: {user_tenant_id}, Resource tenant: {resource_tenant_id}"

        all_details = {
            "user_tenant_id": user_tenant_id,
            "resource_tenant_id": resource_tenant_id,
        }
        if details:
            all_details.update(details)

        super().__init__(
            message=message,
            details=all_details
        )


class RateLimitExceededError(SecurityException):
    """Rate limit exceeded error"""

    def __init__(
        self,
        limit: int = None,
        window: int = None,
        details: Dict[str, Any] = None
    ):
        message = "Rate limit exceeded"
        if limit:
            message += f". Limit: {limit} requests"
        if window:
            message += f" per {window} seconds"

        all_details = {
            "rate_limit": limit,
            "rate_window": window,
        }
        if details:
            all_details.update(details)

        super().__init__(
            message=message,
            error_code="RATE_LIMIT_EXCEEDED",
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            details=all_details
        )


class AccountLockedException(SecurityException):
    """Account locked error"""

    def __init__(
        self,
        lockout_reason: str = None,
        lockout_until: datetime = None,
        details: Dict[str, Any] = None
    ):
        message = "Account is locked"
        if lockout_reason:
            message += f". Reason: {lockout_reason}"
        if lockout_until:
            message += f". Locked until: {lockout_until.isoformat()}"

        all_details = {
            "lockout_reason": lockout_reason,
            "lockout_until": lockout_until.isoformat() if lockout_until else None,
        }
        if details:
            all_details.update(details)

        super().__init__(
            message=message,
            error_code="ACCOUNT_LOCKED",
            status_code=status.HTTP_423_LOCKED,
            details=all_details
        )


# Exception handler functions
async def security_exception_handler(request: Request, exc: SecurityException) -> JSONResponse:
    """Handle custom security exceptions"""
    logger.warning(
        f"Security exception: {exc.error_code} - {exc.message}",
        extra={
            "error_code": exc.error_code,
            "status_code": exc.status_code,
            "details": exc.details,
            "path": request.url.path,
            "method": request.method,
        }
    )

    # Create error response
    error_response = {
        "error": {
            "code": exc.error_code,
            "message": exc.message,
            "timestamp": datetime.utcnow().isoformat(),
            "path": request.url.path,
            "method": request.method,
        }
    }

    # Add details if provided (and not in production)
    if exc.details:
        error_response["error"]["details"] = exc.details

    return JSONResponse(
        status_code=exc.status_code,
        content=error_response
    )


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Handle HTTP exceptions with security context"""
    # Log security-related HTTP exceptions
    if exc.status_code in [401, 403, 423, 429]:
        logger.warning(
            f"HTTP security exception: {exc.status_code} - {exc.detail}",
            extra={
                "status_code": exc.status_code,
                "path": request.url.path,
                "method": request.method,
                "client_ip": request.client.host if request.client else None,
            }
        )

    # Create standardized error response
    error_response = {
        "error": {
            "code": f"HTTP_{exc.status_code}",
            "message": exc.detail,
            "timestamp": datetime.utcnow().isoformat(),
            "path": request.url.path,
            "method": request.method,
        }
    }

    return JSONResponse(
        status_code=exc.status_code,
        content=error_response
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handle request validation exceptions"""
    logger.warning(
        f"Validation error in request: {request.method} {request.url.path}",
        extra={
            "validation_errors": exc.errors(),
            "path": request.url.path,
            "method": request.method,
        }
    )

    # Create validation error response
    error_response = {
        "error": {
            "code": "VALIDATION_ERROR",
            "message": "Request validation failed",
            "timestamp": datetime.utcnow().isoformat(),
            "path": request.url.path,
            "method": request.method,
            "validation_errors": exc.errors(),
        }
    }

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=error_response
    )


async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle general exceptions"""
    # Log the full exception for debugging
    logger.error(
        f"Unhandled exception in request: {request.method} {request.url.path}",
        extra={
            "exception_type": type(exc).__name__,
            "exception_message": str(exc),
            "traceback": traceback.format_exc(),
            "path": request.url.path,
            "method": request.method,
        }
    )

    # Create generic error response (don't expose internal details)
    error_response = {
        "error": {
            "code": "INTERNAL_SERVER_ERROR",
            "message": "An internal server error occurred",
            "timestamp": datetime.utcnow().isoformat(),
            "path": request.url.path,
            "method": request.method,
        }
    }

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=error_response
    )


# Security audit logging
def log_security_event(
    event_type: str,
    message: str,
    user_id: str = None,
    tenant_id: str = None,
    ip_address: str = None,
    user_agent: str = None,
    details: Dict[str, Any] = None
) -> None:
    """
    Log security-related events for audit purposes

    Args:
        event_type: Type of security event (e.g., "LOGIN_FAILED", "PERMISSION_DENIED")
        message: Event message
        user_id: User ID if available
        tenant_id: Tenant ID if available
        ip_address: Client IP address
        user_agent: Client user agent
        details: Additional event details
    """
    log_data = {
        "event_type": event_type,
        "event_message": message,  # Use event_message instead of message to avoid LogRecord conflict
        "timestamp": datetime.utcnow().isoformat(),
    }

    if user_id:
        log_data["user_id"] = user_id
    if tenant_id:
        log_data["tenant_id"] = tenant_id
    if ip_address:
        log_data["ip_address"] = ip_address
    if user_agent:
        log_data["user_agent"] = user_agent
    if details:
        log_data.update(details)

    logger.info(f"SECURITY_AUDIT: {event_type} - {message}", extra={"security_data": log_data})


def log_authentication_event(
    event_type: str,
    token_data: TokenData = None,
    request: Request = None,
    success: bool = True,
    reason: str = None
) -> None:
    """
    Log authentication-related events

    Args:
        event_type: Type of authentication event
        token_data: Token data if available
        request: Request object
        success: Whether authentication was successful
        reason: Reason for failure if applicable
    """
    message = f"Authentication {event_type}"
    if not success:
        message = f"Authentication failed: {event_type}"
    if reason:
        message += f" - {reason}"

    details = {}
    if token_data:
        details.update({
            "user_id": token_data.user_id,
            "tenant_id": token_data.tenant_id,
            "role_id": token_data.role_id,
            "permissions_count": len(token_data.permissions),
        })
    if request:
        details.update({
            "path": request.url.path,
            "method": request.method,
            "ip_address": request.client.host if request.client else None,
        })

    log_security_event(
        event_type=event_type,
        message=message,
        user_id=token_data.user_id if token_data else None,
        tenant_id=token_data.tenant_id if token_data else None,
        ip_address=request.client.host if request and request.client else None,
        details=details
    )