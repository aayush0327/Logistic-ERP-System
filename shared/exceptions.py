"""
Custom exceptions for the Logistics ERP system
"""
from typing import Any, Dict, Optional


class BaseLogisticsException(Exception):
    """Base exception class for all custom exceptions"""

    def __init__(
        self,
        message: str,
        error_code: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        self.message = message
        self.error_code = error_code or self.__class__.__name__
        self.details = details or {}
        super().__init__(self.message)


class AuthenticationError(BaseLogisticsException):
    """Raised when authentication fails"""
    pass


class AuthorizationError(BaseLogisticsException):
    """Raised when user is not authorized"""
    pass


class TenantError(BaseLogisticsException):
    """Raised for tenant-related errors"""
    pass


class ValidationError(BaseLogisticsException):
    """Raised when validation fails"""
    pass


class NotFoundError(BaseLogisticsException):
    """Raised when a resource is not found"""
    pass


class ConflictError(BaseLogisticsException):
    """Raised when there's a conflict with existing data"""
    pass


class BusinessLogicError(BaseLogisticsException):
    """Raised for business logic violations"""
    pass


class ExternalServiceError(BaseLogisticsException):
    """Raised when external service calls fail"""
    pass


class DatabaseError(BaseLogisticsException):
    """Raised for database-related errors"""
    pass


class CacheError(BaseLogisticsException):
    """Raised for cache-related errors"""
    pass


class EventPublishError(BaseLogisticsException):
    """Raised when event publishing fails"""
    pass


class FileUploadError(BaseLogisticsException):
    """Raised for file upload errors"""
    pass


class RateLimitExceededError(BaseLogisticsException):
    """Raised when rate limit is exceeded"""
    pass