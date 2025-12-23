"""
Tenant isolation middleware for Company Service
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
            "/health",
            "/ready",
            "/metrics",
            "/docs",
            "/openapi.json",
            "/redoc",
        ]

        if request.url.path in skip_paths:
            return await call_next(request)

        # Ensure request has user context (from authentication middleware)
        if not hasattr(request.state, 'tenant_id'):
            logger.error("Request missing tenant context")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
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
        # Resource operations that need tenant validation
        resource_patterns = [
            "/branches/",
            "/customers/",
            "/vehicles/",
            "/products/",
            "/product-categories/",
            "/service-zones/",
            "/pricing-rules/",
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

        # For paths like /api/v1/branches/{branch_id}
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


class BranchAccessMiddleware(BaseHTTPMiddleware):
    """
    Middleware to validate branch-level access permissions
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        """
        Validate branch access for branch-specific operations

        Args:
            request: Incoming request
            call_next: Next middleware in chain

        Returns:
            HTTP response
        """
        # Only apply to branch-related endpoints
        if not request.url.path.startswith("/branches/"):
            return await call_next(request)

        # Skip for public endpoints like listing
        if request.url.path == "/branches/" and request.method == "GET":
            return await call_next(request)

        # Get user context
        user_id = getattr(request.state, 'user_id', None)
        user_permissions = getattr(request.state, 'permissions', [])
        is_super_user = getattr(request.state, 'is_super_user', False)
        tenant_id = getattr(request.state, 'tenant_id', None)

        # Super users bypass branch access checks
        if is_super_user:
            return await call_next(request)

        # Check for branch management permissions
        has_branch_manage_all = "branches:manage_all" in user_permissions
        has_branch_manage_own = "branches:manage_own" in user_permissions

        if not (has_branch_manage_all or has_branch_manage_own):
            # Check for specific operation permissions
            if request.method == "GET" and "branches:read" in user_permissions:
                return await call_next(request)
            elif request.method == "POST" and "branches:create" in user_permissions:
                return await call_next(request)
            elif request.method in ["PUT", "PATCH"] and "branches:update" in user_permissions:
                return await call_next(request)
            elif request.method == "DELETE" and "branches:delete" in user_permissions:
                return await call_next(request)
            else:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Insufficient permissions for branch operations"
                )

        # For non-admin users, validate they can access the specific branch
        if has_branch_manage_own and not has_branch_manage_all:
            branch_id = self._extract_branch_id(request)
            if branch_id:
                if not await self._validate_branch_access(user_id, branch_id, tenant_id):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Access denied: You can only manage your assigned branches"
                    )

        return await call_next(request)

    def _extract_branch_id(self, request: Request) -> Optional[str]:
        """
        Extract branch ID from request path

        Args:
            request: Incoming request

        Returns:
            Branch ID if found, None otherwise
        """
        path_parts = request.url.path.strip("/").split("/")

        # For /branches/{branch_id} or /branches/{branch_id}/...
        if len(path_parts) >= 2 and path_parts[0] == "branches":
            return path_parts[1]

        return None

    async def _validate_branch_access(
        self,
        user_id: str,
        branch_id: str,
        tenant_id: str
    ) -> bool:
        """
        Validate that user can access the specified branch

        Args:
            user_id: User ID
            branch_id: Branch ID to validate
            tenant_id: Tenant ID

        Returns:
            True if user can access branch, False otherwise

        Note:
            This is a placeholder implementation. In a real system,
            you would query your database to check if the user is
            assigned to this branch as a manager or has access rights.
        """
        # TODO: Implement actual branch access validation
        # This would typically involve:
        # 1. Querying the branches table to get branch details
        # 2. Checking if user is assigned as branch manager
        # 3. Checking user role and permissions within the branch
        # 4. Verifying branch belongs to the user's tenant

        # For now, we'll assume the user has access
        # In production, implement proper database validation
        return True


class CustomerAccessMiddleware(BaseHTTPMiddleware):
    """
    Middleware to validate customer access permissions
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        """
        Validate customer access based on user permissions and branch assignments

        Args:
            request: Incoming request
            call_next: Next middleware in chain

        Returns:
            HTTP response
        """
        # Only apply to customer-related endpoints
        if not request.url.path.startswith("/customers/"):
            return await call_next(request)

        # Get user context
        user_permissions = getattr(request.state, 'permissions', [])
        is_super_user = getattr(request.state, 'is_super_user', False)
        user_id = getattr(request.state, 'user_id', None)

        # Super users bypass customer access checks
        if is_super_user:
            return await call_next(request)

        # Check customer access permissions
        has_customer_read_all = "customers:read_all" in user_permissions
        has_customer_read_own = "customers:read_own" in user_permissions
        has_customer_update_own = "customers:update_own" in user_permissions

        # For customer-specific operations (update/delete), validate ownership
        if request.method in ["PUT", "PATCH", "DELETE"]:
            customer_id = self._extract_customer_id(request)
            if customer_id and not has_customer_read_all:
                # For users with only own-customer access, validate ownership
                if not await self._validate_customer_ownership(user_id, customer_id):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Access denied: You can only manage your own customers"
                    )

        return await call_next(request)

    def _extract_customer_id(self, request: Request) -> Optional[str]:
        """
        Extract customer ID from request path

        Args:
            request: Incoming request

        Returns:
            Customer ID if found, None otherwise
        """
        path_parts = request.url.path.strip("/").split("/")

        # For /customers/{customer_id} or /customers/{customer_id}/...
        if len(path_parts) >= 2 and path_parts[0] == "customers":
            return path_parts[1]

        return None

    async def _validate_customer_ownership(
        self,
        user_id: str,
        customer_id: str
    ) -> bool:
        """
        Validate that user owns or can access the specified customer

        Args:
            user_id: User ID
            customer_id: Customer ID to validate

        Returns:
            True if user can access customer, False otherwise

        Note:
            This is a placeholder implementation. In a real system,
            you would query your database to check customer ownership
            or assignment based on your business logic.
        """
        # TODO: Implement actual customer ownership validation
        # This would typically involve:
        # 1. Querying the customers table
        # 2. Checking if the user created or is assigned to the customer
        # 3. Validating branch assignments if applicable

        # For now, we'll assume the user has access
        # In production, implement proper database validation
        return True