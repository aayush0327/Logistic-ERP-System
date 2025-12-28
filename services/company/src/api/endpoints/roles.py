"""
Role management endpoints
"""
import logging
import httpx

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import AsyncSessionLocal
from src.config_local import settings
from src.schemas import (
    CompanyRole as CompanyRoleSchema,
    CompanyRoleCreate,
    CompanyRoleUpdate,
    PaginatedResponse
)
from src.security import (
    TokenData,
    get_current_tenant_id,
    require_permissions,
    require_any_permission,
    ROLE_READ,
    ROLE_CREATE,
    ROLE_UPDATE,
    ROLE_DELETE,
    ROLE_ASSIGN,
)

router = APIRouter()
logger = logging.getLogger(__name__)


# Dependency to get database session
async def get_db() -> AsyncSession:
    """Get database session"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


@router.get("/auth-roles")
async def get_auth_roles(
    request: Request,
    token_data: TokenData = Depends(require_any_permission([*ROLE_READ]))
):
    """
    Get roles from auth service
    This endpoint calls the auth service's roles API and returns the roles

    Requires: ROLE_READ permission
    """
    auth_service_url = settings.AUTH_SERVICE_URL

    # Get authorization header from request to pass to auth service
    auth_headers = {
        "Accept": "application/json"
    }
    auth_header = request.headers.get("authorization")
    if auth_header:
        auth_headers["Authorization"] = auth_header

    try:
        # Enable follow_redirects to handle 307 redirects
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            response = await client.get(
                f"{auth_service_url}/api/v1/roles",
                headers=auth_headers
            )

            if response.status_code == 200:
                return response.json()
            else:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Auth service returned error: {response.text}"
                )
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail="Auth service request timed out"
        )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=503,
            detail=f"Failed to reach auth service: {str(e)}"
        )


@router.get("/", response_model=PaginatedResponse, status_code=410)
async def list_roles(
    token_data: TokenData = Depends(require_permissions([*ROLE_READ])),
    tenant_id: str = Depends(get_current_tenant_id),
):
    """
    [DEPRECATED] List all roles for the current tenant

    This endpoint is deprecated. Please use the auth service roles API instead.
    GET /api/v1/roles/ in the auth service.

    Requires: ROLE_READ permission
    """
    raise HTTPException(
        status_code=410,
        detail={
            "message": "This endpoint is deprecated. Please use the auth service roles API.",
            "use": "GET /api/v1/roles/ in the auth service",
            "proxy_available": "GET /api/v1/roles/auth-roles can be used as a proxy to auth service"
        }
    )


@router.get("/{role_id}", response_model=CompanyRoleSchema, status_code=410)
async def get_role(
    role_id: str,
    token_data: TokenData = Depends(require_permissions([*ROLE_READ])),
    tenant_id: str = Depends(get_current_tenant_id),
):
    """
    [DEPRECATED] Get a specific role by ID

    This endpoint is deprecated. Please use the auth service roles API instead.
    GET /api/v1/roles/{role_id} in the auth service.

    Requires: ROLE_READ permission
    """
    raise HTTPException(
        status_code=410,
        detail={
            "message": "This endpoint is deprecated. Please use the auth service roles API.",
            "use": "GET /api/v1/roles/{role_id} in the auth service",
            "proxy_available": "GET /api/v1/roles/auth-roles can be used as a proxy to auth service"
        }
    )


@router.post("/", response_model=CompanyRoleSchema, status_code=410)
async def create_role(
    role_data: CompanyRoleCreate,
    token_data: TokenData = Depends(require_permissions([*ROLE_CREATE])),
    tenant_id: str = Depends(get_current_tenant_id),
):
    """
    [DEPRECATED] Create a new role

    This endpoint is deprecated. Please use the auth service roles API instead.
    POST /api/v1/roles/ in the auth service.

    Requires: ROLE_CREATE permission
    """
    raise HTTPException(
        status_code=410,
        detail={
            "message": "This endpoint is deprecated. Please use the auth service roles API.",
            "use": "POST /api/v1/roles/ in the auth service"
        }
    )


@router.put("/{role_id}", response_model=CompanyRoleSchema, status_code=410)
async def update_role(
    role_id: str,
    role_data: CompanyRoleUpdate,
    token_data: TokenData = Depends(require_permissions([*ROLE_UPDATE])),
    tenant_id: str = Depends(get_current_tenant_id),
):
    """
    [DEPRECATED] Update a role

    This endpoint is deprecated. Please use the auth service roles API instead.
    PUT /api/v1/roles/{role_id} in the auth service.

    Requires: ROLE_UPDATE permission
    """
    raise HTTPException(
        status_code=410,
        detail={
            "message": "This endpoint is deprecated. Please use the auth service roles API.",
            "use": "PUT /api/v1/roles/{role_id} in the auth service"
        }
    )


@router.delete("/{role_id}", status_code=410)
async def delete_role(
    role_id: str,
    token_data: TokenData = Depends(require_permissions([*ROLE_DELETE])),
    tenant_id: str = Depends(get_current_tenant_id),
):
    """
    [DEPRECATED] Delete a role

    This endpoint is deprecated. Please use the auth service roles API instead.
    DELETE /api/v1/roles/{role_id} in the auth service.

    Requires: ROLE_DELETE permission
    """
    raise HTTPException(
        status_code=410,
        detail={
            "message": "This endpoint is deprecated. Please use the auth service roles API.",
            "use": "DELETE /api/v1/roles/{role_id} in the auth service"
        }
    )


@router.get("/{role_id}/permissions", status_code=410)
async def get_role_permissions(
    role_id: str,
    token_data: TokenData = Depends(require_permissions([*ROLE_READ])),
    tenant_id: str = Depends(get_current_tenant_id),
):
    """
    [DEPRECATED] Get permissions for a specific role

    This endpoint is deprecated. Role permissions are managed in the auth service.
    GET /api/v1/roles/{role_id} in the auth service includes permissions.

    Requires: ROLE_READ permission
    """
    raise HTTPException(
        status_code=410,
        detail={
            "message": "This endpoint is deprecated. Role permissions are managed in the auth service.",
            "use": "GET /api/v1/roles/{role_id} in the auth service (includes permissions)"
        }
    )


@router.put("/{role_id}/permissions", status_code=410)
async def update_role_permissions(
    role_id: str,
    permissions: dict,
    token_data: TokenData = Depends(require_permissions([*ROLE_ASSIGN])),
    tenant_id: str = Depends(get_current_tenant_id),
):
    """
    [DEPRECATED] Update permissions for a specific role

    This endpoint is deprecated. Role permissions are managed in the auth service.
    PUT /api/v1/roles/{role_id} in the auth service.

    Requires: ROLE_ASSIGN permission
    """
    raise HTTPException(
        status_code=410,
        detail={
            "message": "This endpoint is deprecated. Role permissions are managed in the auth service.",
            "use": "PUT /api/v1/roles/{role_id} in the auth service"
        }
    )


@router.get("/default/permissions", status_code=410)
async def get_default_permissions():
    """
    [DEPRECATED] Get default permission template for creating new roles

    This endpoint is deprecated. Permissions are managed in the auth service.
    """
    raise HTTPException(
        status_code=410,
        detail={
            "message": "This endpoint is deprecated. Permissions are managed in the auth service.",
            "use": "Refer to auth service documentation for permission structure"
        }
    )


@router.post("/seed", status_code=410)
async def seed_default_roles(
    token_data: TokenData = Depends(require_permissions([*ROLE_CREATE])),
    tenant_id: str = Depends(get_current_tenant_id),
):
    """
    [DEPRECATED] Seed default system roles for a new tenant

    This endpoint is deprecated. Default roles are managed in the auth service.
    Contact your system administrator to set up default roles for a new tenant.

    Requires: ROLE_CREATE permission
    """
    raise HTTPException(
        status_code=410,
        detail={
            "message": "This endpoint is deprecated. Default roles are managed in the auth service.",
            "use": "Contact your system administrator to set up default roles for a new tenant"
        }
    )
