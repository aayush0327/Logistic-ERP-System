"""
Tenant isolation middleware for TMS Service - Based on Company Service Implementation
"""
from typing import Optional
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import logging

from ..security import log_security_event, TenantAccessError

logger = logging.getLogger(__name__)


class TenantIsolationMiddleware(BaseHTTPMiddleware):
    """
    Middleware to enforce tenant isolation for multi-tenant architecture
    """

    def __init__(self, app):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next) -> Response:
        """
        Process request through tenant isolation middleware

        Args:
            request: Incoming request
            call_next: Next middleware in chain

        Returns:
            HTTP response
        """

        # Skip tenant isolation for health checks and docs
        skip_paths = [
            "/",
            "/health",
            "/ready",
            "/metrics",
            "/docs",
            "/openapi.json",
            "/redoc",
            "/favicon.ico",
        ]

        if request.url.path in skip_paths:
            logger.info(f"TMS Tenant Isolation Middleware: Skipping tenant check for {request.url.path}")
            return await call_next(request)

        # Check if request is authenticated (has user context from authentication middleware)
        if not hasattr(request.state, 'tenant_id'):
            # This should not happen if authentication middleware is properly configured
            logger.error(f"TMS Tenant Isolation: Request missing tenant context for {request.url.path}")
            # Return 401 instead of 500 to indicate authentication is required
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
                headers={"WWW-Authenticate": "Bearer"},
            )

        tenant_id = request.state.tenant_id
        user_id = getattr(request.state, 'user_id', None)
        is_super_user = getattr(request.state, 'is_super_user', False)

        # Set tenant context for database operations
        request.state.current_tenant_id = tenant_id

        # For non-super users, validate tenant access for resource operations
        if not is_super_user and self._is_resource_operation(request):
            await self._validate_tenant_access(request, tenant_id, user_id)

        return await call_next(request)

    def _is_resource_operation(self, request: Request) -> bool:
        """
        Check if the request is a resource operation that needs tenant validation

        Args:
            request: Incoming request

        Returns:
            True if resource operation, False otherwise
        """
        # Resource operations that need tenant validation (TMS-specific)
        resource_patterns = [
            "/trips/",
            "/orders/",
            "/resources/",
            "/drivers/",
            "/vehicles/",
            "/routes/",
            "/schedules/",
            "/customers/",
        ]

        # Check if path matches any resource pattern
        for pattern in resource_patterns:
            if request.url.path.startswith(pattern):
                return True

        return False

    async def _validate_tenant_access(
        self,
        request: Request,
        user_tenant_id: str,
        user_id: str
    ) -> None:
        """
        Validate that the user can access the requested tenant resource

        Args:
            request: Incoming request
            user_tenant_id: User's tenant ID
            user_id: User's ID

        Raises:
            HTTPException: If tenant access is invalid
        """
        # Extract resource tenant ID from request path or query params
        resource_tenant_id = self._extract_resource_tenant_id(request)

        if resource_tenant_id and resource_tenant_id != user_tenant_id:
            logger.warning(
                f"Tenant access denied: User {user_id} from tenant {user_tenant_id} "
                f"attempting to access resource from tenant {resource_tenant_id}"
            )

            log_security_event(
                "TENANT_ACCESS_DENIED",
                f"User {user_id} denied access to tenant {resource_tenant_id}",
                user_id=user_id,
                user_tenant_id=user_tenant_id,
                details={
                    "resource_tenant_id": resource_tenant_id,
                    "request_path": request.url.path,
                    "request_method": request.method,
                }
            )

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Cannot access resources from other tenants"
            )

    def _extract_resource_tenant_id(self, request: Request) -> Optional[str]:
        """
        Extract tenant ID from request (path, query params, or body)

        Args:
            request: Incoming request

        Returns:
            Tenant ID if found, None otherwise
        """
        # Check query parameters first
        if "tenant_id" in request.query_params:
            return request.query_params["tenant_id"]

        # Check path parameters for specific patterns
        # This is a simplified approach - in practice, you might need
        # more sophisticated path parameter extraction
        path_parts = request.url.path.strip("/").split("/")

        # For paths like /api/v1/trips/{trip_id}
        if len(path_parts) >= 4:
            # Extract resource ID from path (simplified)
            # In a real implementation, you would query the database
            # to get the tenant_id for this resource
            resource_id = path_parts[3]

            # This is a placeholder - you should implement proper
            # resource-to-tenant lookup based on your URL structure
            # and database schema
            return None

        return None


class TenantContextMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add tenant context to database sessions
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        """
        Add tenant context to request state for database operations

        Args:
            request: Incoming request
            call_next: Next middleware in chain

        Returns:
            HTTP response
        """
        # Skip for non-API paths
        if not request.url.path.startswith("/api/"):
            return await call_next(request)

        # Ensure tenant context is available
        if hasattr(request.state, 'current_tenant_id'):
            tenant_id = request.state.current_tenant_id
        elif hasattr(request.state, 'tenant_id'):
            tenant_id = request.state.tenant_id
        else:
            tenant_id = None

        # Add tenant context to request for database operations
        request.state.db_context = {
            "tenant_id": tenant_id,
            "is_super_user": getattr(request.state, 'is_super_user', False),
            "user_id": getattr(request.state, 'user_id', None),
        }

        return await call_next(request)


class TripAccessMiddleware(BaseHTTPMiddleware):
    """
    Middleware to validate trip-level access permissions
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        """
        Validate trip access for trip-specific operations

        Args:
            request: Incoming request
            call_next: Next middleware in chain

        Returns:
            HTTP response
        """
        # Only apply to trip-related endpoints
        if not request.url.path.startswith("/trips/"):
            return await call_next(request)

        # Skip for public endpoints like listing
        if request.url.path == "/trips/" and request.method == "GET":
            return await call_next(request)

        # Get user context
        user_id = getattr(request.state, 'user_id', None)
        user_permissions = getattr(request.state, 'permissions', [])
        is_super_user = getattr(request.state, 'is_super_user', False)
        tenant_id = getattr(request.state, 'tenant_id', None)

        # Super users bypass trip access checks
        if is_super_user:
            return await call_next(request)

        # Check for trip management permissions
        has_trip_update = "trips:update" in user_permissions
        has_trip_delete = "trips:delete" in user_permissions
        has_trip_assign = "trips:assign" in user_permissions

        # Check for specific operation permissions
        if request.method == "GET" and any(perm in user_permissions for perm in ["trips:read", "trips:read_all"]):
            return await call_next(request)
        elif request.method == "POST" and "trips:create" in user_permissions:
            return await call_next(request)
        elif request.method in ["PUT", "PATCH"] and has_trip_update:
            return await call_next(request)
        elif request.method == "DELETE" and has_trip_delete:
            return await call_next(request)
        elif has_trip_assign:
            return await call_next(request)
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions for trip operations"
            )


class OrderAccessMiddleware(BaseHTTPMiddleware):
    """
    Middleware to validate order access permissions
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        """
        Validate order access for order-specific operations

        Args:
            request: Incoming request
            call_next: Next middleware in chain

        Returns:
            HTTP response
        """
        # Only apply to order-related endpoints
        if not request.url.path.startswith("/orders/"):
            return await call_next(request)

        # Skip for public endpoints like listing
        if request.url.path == "/orders/" and request.method == "GET":
            return await call_next(request)

        # Get user context
        user_permissions = getattr(request.state, 'permissions', [])
        is_super_user = getattr(request.state, 'is_super_user', False)

        # Super users bypass order access checks
        if is_super_user:
            return await call_next(request)

        # Check for order management permissions
        has_order_split = "orders:split" in user_permissions
        has_order_reassign = "orders:reassign" in user_permissions

        # Check for specific operation permissions
        if request.method == "GET" and any(perm in user_permissions for perm in ["orders:read", "orders:read_all"]):
            return await call_next(request)
        elif request.method == "POST" and "orders:create" in user_permissions:
            return await call_next(request)
        elif request.method in ["PUT", "PATCH"] and "orders:update" in user_permissions:
            return await call_next(request)
        elif request.method == "DELETE" and "orders:delete" in user_permissions:
            return await call_next(request)
        elif has_order_split or has_order_reassign:
            return await call_next(request)
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions for order operations"
            )


class ResourceAccessMiddleware(BaseHTTPMiddleware):
    """
    Middleware to validate resource access permissions
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        """
        Validate resource access for resource-specific operations

        Args:
            request: Incoming request
            call_next: Next middleware in chain

        Returns:
            HTTP response
        """
        # Only apply to resource-related endpoints
        if not request.url.path.startswith("/resources/"):
            return await call_next(request)

        # Get user context
        user_permissions = getattr(request.state, 'permissions', [])
        is_super_user = getattr(request.state, 'is_super_user', False)

        # Super users bypass resource access checks
        if is_super_user:
            return await call_next(request)

        # Check for resource management permissions
        has_drivers_assign = "drivers:assign" in user_permissions
        has_drivers_update = "drivers:update" in user_permissions
        has_vehicles_track = "vehicles:track" in user_permissions
        has_vehicles_update = "vehicles:update" in user_permissions

        # Check for specific operation permissions
        if request.method == "GET" and any(perm in user_permissions for perm in ["resources:read", "resources:read_all"]):
            return await call_next(request)
        elif has_drivers_assign or has_drivers_update or has_vehicles_track or has_vehicles_update:
            return await call_next(request)
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions for resource operations"
            )