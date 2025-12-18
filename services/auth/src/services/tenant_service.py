"""
Tenant service for managing tenants/companies
"""
from typing import Optional, List
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from sqlalchemy.orm import selectinload

from ..database import Tenant, User
from ..auth import get_password_hash


class TenantService:
    """Service for tenant management operations"""

    @staticmethod
    async def create_tenant_with_admin(db: AsyncSession, name: str, domain: str, admin_data: dict) -> Tenant:
        """Create a new tenant with admin user"""
        from uuid import uuid4
        from sqlalchemy import select

        # Create tenant first
        tenant_id = str(uuid4())
        tenant = Tenant(
            id=tenant_id,
            name=name,
            domain=domain,
            is_active=False,  # Inactive by default until admin is created
            admin_id=None,  # Will be set after admin user is created
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(tenant)
        await db.flush()  # Get tenant ID without committing

        # Use existing role ID 2 (Admin role) instead of creating a new one
        # This maintains consistency across all tenants
        ADMIN_ROLE_ID = 2  # Standard admin role ID

        # Create admin user with role_id = 2
        admin_user = User(
            id=str(uuid4()),
            email=admin_data["email"].lower(),
            password_hash=get_password_hash(admin_data["password"]),
            first_name=admin_data["first_name"],
            last_name=admin_data["last_name"],
            is_active=True,
            is_superuser=False,  # Not system superuser
            tenant_id=tenant_id,
            role_id=ADMIN_ROLE_ID,  # Use the standard admin role ID 2
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(admin_user)
        await db.flush()

        # Update tenant with admin_id and activate it
        tenant.admin_id = admin_user.id
        tenant.is_active = True  # Activate now that admin is assigned

        await db.commit()
        await db.refresh(tenant)

        return tenant

    @staticmethod
    async def create_tenant(db: AsyncSession, name: str, domain: str, admin_data: dict) -> Tenant:
        """Create a new tenant with admin user (legacy method)"""
        from uuid import uuid4

        # Create tenant
        tenant = Tenant(
            id=str(uuid4()),
            name=name,
            domain=domain,
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        # Use existing role ID 2 (Admin role) instead of creating a new one
        ADMIN_ROLE_ID = 2  # Standard admin role ID

        # Create admin user with role_id = 2
        admin_user = User(
            id=str(uuid4()),
            email=admin_data["email"].lower(),
            password_hash=get_password_hash(admin_data["password"]),
            first_name=admin_data["first_name"],
            last_name=admin_data["last_name"],
            is_active=True,
            is_superuser=False,  # Not system superuser
            tenant_id=tenant.id,
            role_id=ADMIN_ROLE_ID,  # Use the standard admin role ID 2
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        # Set admin_id for the tenant
        tenant.admin_id = admin_user.id

        # Add to database
        db.add(tenant)
        db.add(admin_user)

        await db.commit()
        await db.refresh(tenant)

        return tenant

    @staticmethod
    async def activate_tenant(db: AsyncSession, tenant_id: str) -> bool:
        """Activate a tenant when admin is assigned"""
        query = update(Tenant).where(Tenant.id == tenant_id).values(
            is_active=True,
            updated_at=datetime.utcnow()
        )
        result = await db.execute(query)
        await db.commit()

        return result.rowcount > 0

    @staticmethod
    async def get_all_tenants(db: AsyncSession) -> List[Tenant]:
        """Get all tenants (Super Admin only)"""
        query = select(Tenant).options(
            selectinload(Tenant.users),
            selectinload(Tenant.admin)
        ).order_by(Tenant.created_at.desc())

        result = await db.execute(query)
        tenants = result.scalars().all()

        # Manually load admin users if not already loaded
        for tenant in tenants:
            if tenant.admin_id and not tenant.admin:
                admin_query = select(User).where(User.id == tenant.admin_id)
                admin_result = await db.execute(admin_query)
                tenant.admin = admin_result.scalar_one_or_none()

        return tenants

    @staticmethod
    async def get_all_tenants_with_stats(db: AsyncSession) -> List[dict]:
        """Get all tenants with their stats in a single query (Super Admin only)"""
        from sqlalchemy import select, func
        from ..database import User

        # Get all tenants
        tenants_query = select(Tenant).order_by(Tenant.created_at.desc())
        tenants_result = await db.execute(tenants_query)
        tenants = tenants_result.scalars().all()

        # Get user counts for all tenants in one query
        user_counts_query = select(
            User.tenant_id,
            func.count(User.id).label('user_count')
        ).where(
            User.tenant_id.isnot(None)
        ).group_by(User.tenant_id)

        user_counts_result = await db.execute(user_counts_query)
        user_counts = {row.tenant_id: row.user_count for row in user_counts_result}

        # Get admin info for all tenants in one query
        admin_ids = [t.admin_id for t in tenants if t.admin_id]
        admins_query = select(User).where(User.id.in_(admin_ids))
        admins_result = await db.execute(admins_query)
        admins = {admin.id: admin for admin in admins_result.scalars()}

        # Combine the data
        result = []
        for tenant in tenants:
            admin_info = None
            if tenant.admin_id and tenant.admin_id in admins:
                admin = admins[tenant.admin_id]
                admin_info = {
                    "id": admin.id,
                    "email": admin.email,
                    "first_name": admin.first_name,
                    "last_name": admin.last_name,
                    "is_active": admin.is_active
                }

            result.append({
                "id": tenant.id,
                "name": tenant.name,
                "domain": tenant.domain,
                "settings": tenant.settings,
                "is_active": tenant.is_active,
                "created_at": tenant.created_at,
                "updated_at": tenant.updated_at,
                "total_users": user_counts.get(tenant.id, 0),
                "admin_email": admin_info["email"] if admin_info else None,
                "admin": admin_info
            })

        return result

    @staticmethod
    async def get_tenant_by_id(db: AsyncSession, tenant_id: str) -> Optional[Tenant]:
        """Get tenant by ID"""
        query = select(Tenant).options(
            selectinload(Tenant.users),
            selectinload(Tenant.admin)
        ).where(Tenant.id == tenant_id)

        result = await db.execute(query)
        tenant = result.scalar_one_or_none()

        # Manually load admin if not already loaded
        if tenant and tenant.admin_id and not tenant.admin:
            admin_query = select(User).where(User.id == tenant.admin_id)
            admin_result = await db.execute(admin_query)
            tenant.admin = admin_result.scalar_one_or_none()

        return tenant

    @staticmethod
    async def update_tenant(db: AsyncSession, tenant_id: str, update_data: dict) -> Optional[Tenant]:
        """Update tenant details"""
        # Remove fields that shouldn't be updated directly
        allowed_fields = {"name", "domain", "settings", "is_active"}
        update_data = {k: v for k, v in update_data.items()
                       if k in allowed_fields}

        if not update_data:
            return await TenantService.get_tenant_by_id(db, tenant_id)

        update_data["updated_at"] = datetime.utcnow()

        query = update(Tenant).where(
            Tenant.id == tenant_id).values(**update_data)
        await db.execute(query)
        await db.commit()

        return await TenantService.get_tenant_by_id(db, tenant_id)

    @staticmethod
    async def delete_tenant(db: AsyncSession, tenant_id: str) -> bool:
        """Delete a tenant (hard delete)"""
        from sqlalchemy import delete
        from ..database import Role, RolePermission

        # First delete all role permissions for roles in this tenant
        delete_role_perms_query = delete(RolePermission).where(
            RolePermission.role_id.in_(
                select(Role.id).where(Role.tenant_id == tenant_id)
            )
        )
        await db.execute(delete_role_perms_query)

        # Delete ALL users for this tenant (including admin)
        delete_users_query = delete(User).where(User.tenant_id == tenant_id)
        await db.execute(delete_users_query)

        # Now delete all roles for this tenant (no users reference them anymore)
        delete_roles_query = delete(Role).where(Role.tenant_id == tenant_id)
        await db.execute(delete_roles_query)

        # Finally delete the tenant
        delete_tenant_query = delete(Tenant).where(Tenant.id == tenant_id)
        result = await db.execute(delete_tenant_query)
        await db.commit()

        return result.rowcount > 0

    @staticmethod
    async def get_tenant_stats(db: AsyncSession, tenant_id: str) -> dict:
        """Get statistics for a tenant"""
        from sqlalchemy import select, func
        from sqlalchemy.orm import selectinload

        # Get user count using aggregate function for better performance
        user_count_query = select(func.count(User.id)).where(User.tenant_id == tenant_id)
        user_count_result = await db.execute(user_count_query)
        user_count = user_count_result.scalar()

        # Get tenant details with admin
        tenant_query = select(Tenant).options(
            selectinload(Tenant.admin)
        ).where(Tenant.id == tenant_id)
        tenant_result = await db.execute(tenant_query)
        tenant = tenant_result.scalar_one_or_none()

        if not tenant:
            return None

        # Get admin details if admin_id exists
        admin_info = None
        if tenant.admin_id:
            admin_query = select(User).where(User.id == tenant.admin_id)
            admin_result = await db.execute(admin_query)
            admin = admin_result.scalar_one_or_none()
            if admin:
                admin_info = {
                    "id": admin.id,
                    "email": admin.email,
                    "first_name": admin.first_name,
                    "last_name": admin.last_name,
                    "is_active": admin.is_active
                }

        return {
            "id": tenant.id,
            "name": tenant.name,
            "domain": tenant.domain,
            "is_active": tenant.is_active,
            "created_at": tenant.created_at,
            "total_users": user_count or 0,
            "admin": admin_info
        }
