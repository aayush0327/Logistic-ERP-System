"""
Tenant service for managing tenants/companies
"""
from typing import Optional, List
from datetime import datetime
from uuid import uuid4
import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from sqlalchemy.orm import selectinload

from ..database import Tenant, User, Role, Permission, RolePermission
from ..auth import get_password_hash
from ..config_local import Settings


async def create_default_roles_for_tenant(db: AsyncSession, tenant_id: str) -> dict:
    """
    Create default roles for a new tenant with appropriate permissions.

    Args:
        db: Database session
        tenant_id: Tenant ID to create roles for

    Returns:
        Dictionary mapping role names to their IDs
    """
    from ..database import Permission

    # Define default roles for a new tenant
    default_roles = [
        {
            "name": "Admin",
            "description": "Organization administrator with full access",
            "is_system": True,
            "permissions": [
                # Orders - all permissions
                "orders:create", "orders:read", "orders:read_all", "orders:update",
                "orders:delete", "orders:cancel", "orders:status_update", "orders:priority_update",
                "orders:approve_finance", "orders:approve_logistics", "orders:approve_any",
                "orders:bulk_approve", "orders:financial_view", "orders:financial_edit",
                "orders:payment_process", "orders:refund_process", "orders:logistics_view",
                "orders:logistics_edit", "orders:shipment_create", "orders:tracking_update",
                "orders:delivery_confirm", "orders:export", "orders:import",
                "orders:split", "orders:reassign",
                # Order documents
                "order_documents:upload", "order_documents:read", "order_documents:read_all",
                "order_documents:update", "order_documents:delete", "order_documents:verify",
                "order_documents:download", "order_documents:create",
                # Branches
                "branches:create", "branches:read", "branches:read_all", "branches:update",
                "branches:delete", "branches:manage_all", "branches:manage_own",
                # Customers
                "customers:create", "customers:read", "customers:read_all", "customers:update", "customers:delete",
                # Products
                "products:create", "products:read", "products:read_all", "products:update",
                "products:delete", "products:stock_adjust", "products:pricing_update",
                # Vehicles
                "vehicles:create", "vehicles:read", "vehicles:read_all", "vehicles:update",
                "vehicles:delete", "vehicles:assign", "vehicles:track", "vehicles:maintenance",
                # Trips/TMS
                "trips:create", "trips:read", "trips:read_all", "trips:update",
                "trips:delete", "trips:assign", "trips:track",
                # Resources
                "resources:read", "resources:read_all",
                # Drivers
                "drivers:assign", "drivers:update",
                # Driver service
                "driver:read", "driver:read_all", "driver:update",
                # Routes
                "routes:create", "routes:optimize", "routes:update",
                # Schedules
                "schedules:read", "schedules:update",
                # Billing
                "billing:create", "billing:read", "billing:read_all", "billing:update", "billing:delete",
                # Suppliers
                "suppliers:create", "suppliers:read", "suppliers:read_all", "suppliers:update", "suppliers:delete",
                # Shipping
                "shipping:create", "shipping:read", "shipping:read_all", "shipping:update", "shipping:delete",
                # Product categories
                "product_categories:create", "product_categories:read", "product_categories:read_all",
                "product_categories:update", "product_categories:delete",
                # Reports
                "reports:read", "reports:read_all", "reports:create", "reports:export",
                # Company reports
                "company_reports:read", "company_reports:read_all", "company_reports:export",
                # Users
                "users:create", "users:read", "users:read_all", "users:update", "users:delete",
                "users:manage_all", "users:invite", "users:activate",
                # Roles
                "roles:create", "roles:read", "roles:update", "roles:delete", "roles:assign",
                # Permissions
                "permissions:read", "permissions:assign",
                # Tenants
                "tenants:read", "tenants:manage_own",
                # Profiles
                "profiles:read", "profiles:create", "profiles:update", "profiles:delete", "profiles:upload_avatar",
                # Dashboard
                "dashboard:read", "dashboard:read_all",
                # Finance
                "finance:read", "finance:approve", "finance:approve_bulk", "finance:reports", "finance:export",
                # Audit
                "audit:read", "audit:export",
                # Marketing Person Assignments
                "marketing_person_assignments:read", "marketing_person_assignments:create",
                "marketing_person_assignments:update", "marketing_person_assignments:delete",
            ]
        },
        {
            "name": "Branch Manager",
            "description": "Manages branch operations and orders",
            "is_system": False,
            "permissions": [
                "orders:create", "orders:read", "orders:read_all", "orders:update", "orders:delete",
                "orders:cancel", "orders:status_update", "orders:priority_update", "orders:export",
                "order_documents:upload", "order_documents:read", "order_documents:read_all",
                "order_documents:update", "order_documents:delete", "order_documents:download",
                "branches:read", "branches:read_all", "branches:update", "branches:manage_own",
                "customers:create", "customers:read", "customers:read_all", "customers:update",
                "vehicles:read", "vehicles:read_all", "vehicles:assign",
                "products:read", "products:read_all",
                "company_reports:read", "company_reports:export",
                "reports:read", "dashboard:read",
                "finance:read", "finance:reports",
            ]
        },
        {
            "name": "Finance Manager",
            "description": "Handles financial approvals and billing",
            "is_system": False,
            "permissions": [
                "orders:read", "orders:read_all", "orders:update",
                "orders:approve_finance", "orders:approve_any", "orders:bulk_approve",
                "orders:financial_view", "orders:financial_edit",
                "orders:payment_process", "orders:refund_process", "orders:export",
                "order_documents:read", "order_documents:read_all", "order_documents:verify", "order_documents:download",
                "billing:create", "billing:read", "billing:read_all", "billing:update", "billing:delete",
                "branches:read", "branches:read_all",
                "company_reports:read", "company_reports:read_all", "company_reports:export",
                "reports:read", "dashboard:read",
                "finance:read", "finance:approve", "finance:approve_bulk", "finance:reports", "finance:export",
            ]
        },
        {
            "name": "Logistics Manager",
            "description": "Manages logistics and transportation",
            "is_system": False,
            "permissions": [
                "orders:read", "orders:read_all", "orders:update",
                "orders:approve_logistics", "orders:approve_any", "orders:bulk_approve",
                "orders:logistics_view", "orders:logistics_edit",
                "orders:shipment_create", "orders:tracking_update", "orders:delivery_confirm",
                "orders:status_update", "orders:export",
                "order_documents:read", "order_documents:read_all", "order_documents:verify", "order_documents:download",
                "trips:create", "trips:read", "trips:read_all", "trips:update", "trips:assign", "trips:track",
                "orders:split", "orders:reassign",
                "resources:read", "resources:read_all",
                "drivers:assign", "drivers:update",
                "driver:read", "driver:read_all", "driver:update",
                "vehicles:read", "vehicles:read_all", "vehicles:assign", "vehicles:maintenance",
                "routes:create", "routes:optimize", "routes:update",
                "schedules:read", "schedules:update",
                "shipping:create", "shipping:read", "shipping:read_all", "shipping:update",
                "vehicles:track",
                "branches:read", "branches:read_all",
                "products:read", "products:read_all",
                "customers:read", "customers:read_all",
                "company_reports:read", "company_reports:read_all", "company_reports:export",
                "reports:read", "dashboard:read",
            ]
        },
        {
            "name": "Driver",
            "description": "Vehicle driver for deliveries",
            "is_system": False,
            "permissions": [
                "orders:read", "orders:update", "orders:tracking_update", "orders:delivery_confirm", "orders:logistics_view",
                "order_documents:read", "order_documents:download",
                "vehicles:read", "vehicles:update",
                "drivers:update", "drivers:read",
                "driver:read", "driver:update",
                "trips:update", "trips:pause",
                "tms:status_update",
                "users:update_own",
                "shipping:read", "shipping:update",
                "dashboard:read",
            ]
        },
        {
            "name": "Marketing Person",
            "description": "Marketing team member with branch-level access",
            "is_system": False,
            "permissions": [
                "orders:create", "orders:read", "orders:read_all", "orders:update", "orders:delete",
                "orders:cancel", "orders:status_update", "orders:priority_update", "orders:export",
                "order_documents:upload", "order_documents:read", "order_documents:read_all",
                "order_documents:update", "order_documents:delete", "order_documents:download",
                "branches:read", "branches:read_all", "branches:update", "branches:manage_own",
                "customers:create", "customers:read", "customers:read_all", "customers:update",
                "vehicles:read", "vehicles:read_all", "vehicles:assign",
                "products:read", "products:read_all",
                "company_reports:read", "company_reports:export",
                "reports:read", "dashboard:read",
                "finance:read", "finance:reports",
            ]
        },
        {
            "name": "User",
            "description": "Regular user with basic access",
            "is_system": False,
            "permissions": [
                "users:read_own", "users:update_own",
                "orders:create", "orders:read", "orders:read_own", "orders:update_own", "orders:cancel",
                "order_documents:read_own", "order_documents:upload", "order_documents:update_own",
                "order_documents:delete_own", "order_documents:download",
                "branches:read", "customers:read", "vehicles:read", "products:read", "product_categories:read",
                "company_reports:read_own", "dashboard:read",
                "finance:read",
            ]
        },
    ]

    role_id_map = {}

    # Get all permissions from database
    permissions_query = select(Permission)
    permissions_result = await db.execute(permissions_query)
    all_permissions = {f"{p.resource}:{p.action}": p.id for p in permissions_result.scalars()}

    # Create each role with its permissions
    for role_def in default_roles:
        # Create role
        role = Role(
            name=role_def["name"],
            description=role_def["description"],
            is_system=role_def["is_system"],
            tenant_id=tenant_id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(role)
        await db.flush()  # Get the role ID

        role_id_map[role_def["name"]] = role.id

        # Create role permissions
        for perm_key in role_def["permissions"]:
            if perm_key in all_permissions:
                role_permission = RolePermission(
                    id=str(uuid4()),
                    role_id=role.id,
                    permission_id=all_permissions[perm_key],
                    created_at=datetime.utcnow()
                )
                db.add(role_permission)

    await db.commit()

    return role_id_map


class TenantService:
    """Service for tenant management operations"""

    @staticmethod
    async def create_tenant_with_admin(
        db: AsyncSession,
        name: str,
        domain: str,
        admin_data: dict,
        currency_code: str = None,
        timezone_iana: str = None,
        timezone_enabled: bool = True
    ) -> Tenant:
        """
        Create a new tenant with admin user and default roles

        Args:
            db: Database session
            name: Tenant name
            domain: Tenant domain
            admin_data: Admin user data
            currency_code: ISO 4217 currency code (defaults to settings.DEFAULT_CURRENCY)
            timezone_iana: IANA timezone identifier (defaults to settings.DEFAULT_TIMEZONE)
            timezone_enabled: Whether timezone conversion is enabled
        """
        # Set defaults from settings
        if currency_code is None:
            currency_code = getattr(Settings, 'DEFAULT_CURRENCY', 'TZS')
        if timezone_iana is None:
            timezone_iana = getattr(Settings, 'DEFAULT_TIMEZONE', 'Africa/Dar_es_Salaam')

        # Import pycountry to get currency symbol
        try:
            import pycountry

            # Get currency symbol
            currency_symbols = {
                "TZS": "TSh", "KES": "KSh", "UGX": "USh", "RWF": "RF",
                "USD": "$", "EUR": "€", "GBP": "£", "INR": "₹",
                "JPY": "¥", "AED": "د.إ", "SAR": "ر.س", "EGP": "Egp"
            }
            symbol = currency_symbols.get(currency_code, currency_code)

            # Get currency info
            currency_obj = pycountry.currencies.get(alpha_3=currency_code)
            currency_name = currency_obj.name if currency_obj else currency_code

            # Build tenant settings JSON
            tenant_settings = {
                "currency": {
                    "code": currency_code,
                    "symbol": symbol,
                    "name": currency_name,
                    "position": "before" if currency_code in ["USD", "EUR", "GBP", "TZS", "KES", "INR"] else "after",
                    "decimal_places": 0 if currency_code == "JPY" else 2,
                    "thousands_separator": ",",
                    "decimal_separator": "."
                },
                "timezone": {
                    "iana": timezone_iana,
                    "enabled": timezone_enabled
                }
            }
        except ImportError:
            # Fallback if pycountry not available
            tenant_settings = {
                "currency": {
                    "code": currency_code,
                    "symbol": currency_code,
                    "name": currency_code,
                    "position": "before",
                    "decimal_places": 2,
                    "thousands_separator": ",",
                    "decimal_separator": "."
                },
                "timezone": {
                    "iana": timezone_iana,
                    "enabled": timezone_enabled
                }
            }

        # Create tenant first with settings
        tenant_id = str(uuid4())
        tenant = Tenant(
            id=tenant_id,
            name=name,
            domain=domain,
            settings=json.dumps(tenant_settings),
            is_active=False,  # Inactive by default until admin is created
            admin_id=None,  # Will be set after admin user is created
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(tenant)
        await db.flush()  # Get tenant ID without committing

        # Create default roles for this tenant (Admin, Branch Manager, Finance Manager, Logistics Manager, Driver, User)
        role_id_map = await create_default_roles_for_tenant(db, tenant_id)

        # Get the Admin role ID for this tenant
        admin_role_id = role_id_map.get("Admin")

        if not admin_role_id:
            raise ValueError("Failed to create Admin role for tenant")

        # Create admin user with the newly created Admin role
        admin_user = User(
            id=str(uuid4()),
            email=admin_data["email"].lower(),
            password_hash=get_password_hash(admin_data["password"]),
            first_name=admin_data["first_name"],
            last_name=admin_data["last_name"],
            is_active=True,
            is_superuser=False,  # Not system superuser
            tenant_id=tenant_id,
            role_id=admin_role_id,  # Use the Admin role created for this tenant
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
        # Create tenant
        tenant = Tenant(
            id=str(uuid4()),
            name=name,
            domain=domain,
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(tenant)
        await db.flush()

        # Create default roles for this tenant
        role_id_map = await create_default_roles_for_tenant(db, tenant.id)

        # Get the Admin role ID for this tenant
        admin_role_id = role_id_map.get("Admin")

        if not admin_role_id:
            raise ValueError("Failed to create Admin role for tenant")

        # Create admin user with the newly created Admin role
        admin_user = User(
            id=str(uuid4()),
            email=admin_data["email"].lower(),
            password_hash=get_password_hash(admin_data["password"]),
            first_name=admin_data["first_name"],
            last_name=admin_data["last_name"],
            is_active=True,
            is_superuser=False,  # Not system superuser
            tenant_id=tenant.id,
            role_id=admin_role_id,  # Use the Admin role created for this tenant
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        # Set admin_id for the tenant
        tenant.admin_id = admin_user.id

        # Add to database
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
    async def deactivate_tenant(db: AsyncSession, tenant_id: str) -> bool:
        """Deactivate a tenant"""
        query = update(Tenant).where(Tenant.id == tenant_id).values(
            is_active=False,
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
    async def delete_tenant(db: AsyncSession, tenant_id: str, auth_token: str = None) -> bool:
        """
        Hard delete a tenant with cascade to all services
        """
        from sqlalchemy import delete
        from ..database import Role, RolePermission, RefreshToken
        import httpx
        import logging

        logger = logging.getLogger(__name__)

        try:
            # Step 1: Delete refresh tokens for users in this tenant
            delete_refresh_tokens_query = delete(RefreshToken).where(
                RefreshToken.user_id.in_(
                    select(User.id).where(User.tenant_id == tenant_id)
                )
            )
            await db.execute(delete_refresh_tokens_query)

            # Step 2: Delete role permissions
            delete_role_perms_query = delete(RolePermission).where(
                RolePermission.role_id.in_(
                    select(Role.id).where(Role.tenant_id == tenant_id)
                )
            )
            await db.execute(delete_role_perms_query)

            # Step 3: Delete all users
            delete_users_query = delete(User).where(User.tenant_id == tenant_id)
            await db.execute(delete_users_query)

            # Step 4: Delete all roles
            delete_roles_query = delete(Role).where(Role.tenant_id == tenant_id)
            await db.execute(delete_roles_query)

            # Step 5: Commit the auth service deletions first
            await db.commit()

            # Step 6: Notify other services to delete their data BEFORE deleting tenant record
            # This ensures other services can still reference the tenant_id
            await TenantService._notify_services_of_deletion(tenant_id, auth_token)

            # Step 7: Now delete the tenant record last
            delete_tenant_query = delete(Tenant).where(Tenant.id == tenant_id)
            result = await db.execute(delete_tenant_query)
            await db.commit()

            return result.rowcount > 0

        except Exception as e:
            logger.error(f"Error deleting tenant {tenant_id}: {e}")
            await db.rollback()
            raise

    @staticmethod
    async def _notify_services_of_deletion(tenant_id: str, auth_token: str = None):
        """
        Notify all other services to delete data for this tenant
        """
        import httpx
        import logging

        logger = logging.getLogger(__name__)

        services = [
            {"name": "company", "url": "http://company-service:8002"},
            {"name": "orders", "url": "http://orders-service:8003"},
            {"name": "tms", "url": "http://tms-service:8004"},
            {"name": "finance", "url": "http://finance-service:8005"},
            {"name": "driver", "url": "http://driver-service:8006"},
        ]

        headers = {"Content-Type": "application/json"}
        if auth_token:
            headers["Authorization"] = f"Bearer {auth_token}"

        for service in services:
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.delete(
                        f"{service['url']}/api/v1/internal/tenant/{tenant_id}",
                        headers=headers
                    )

                    if response.status_code == 200:
                        logger.info(f"Successfully deleted from {service['name']} service")
                    else:
                        logger.error(
                            f"Failed to delete from {service['name']} service: "
                            f"{response.status_code}"
                        )
            except Exception as e:
                logger.error(f"Error notifying {service['name']} service: {e}")
                # Continue with other services even if one fails

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
