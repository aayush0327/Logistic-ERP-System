"""
Middleware for Auth Service
"""
from .tenant_status import TenantStatusMiddleware

__all__ = ["TenantStatusMiddleware"]
