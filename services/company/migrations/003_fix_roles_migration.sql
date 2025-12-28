-- Fix Company Roles Migration
-- This script adds the unique constraint if it doesn't exist
-- and handles the case where tables already exist

-- Add unique constraint to company_roles if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'company_roles_tenant_role_unique'
    ) THEN
        ALTER TABLE company_roles
        ADD CONSTRAINT company_roles_tenant_role_unique
        UNIQUE(tenant_id, role_name);
    END IF;
END
$$;

-- Insert default company roles with safe upsert
INSERT INTO company_roles (
    id,
    tenant_id,
    role_name,
    display_name,
    description,
    permissions,
    is_system_role,
    created_at
) VALUES
-- Company Admin Role
(
    gen_random_uuid()::text,
    'default-tenant',
    'company_admin',
    'Company Administrator',
    'Full access to all company operations and settings',
    '{
        "company": ["read", "write", "delete"],
        "branches": ["read", "write", "delete"],
        "customers": ["read", "write", "delete"],
        "products": ["read", "write", "delete"],
        "categories": ["read", "write", "delete"],
        "vehicles": ["read", "write", "delete"],
        "pricing": ["read", "write", "delete"],
        "employees": ["read", "write", "delete"],
        "reports": ["read"],
        "settings": ["read", "write"],
        "invitations": ["read", "write", "delete"],
        "documents": ["read", "write", "delete"]
    }'::jsonb,
    true,
    CURRENT_TIMESTAMP
)
ON CONFLICT (tenant_id, role_name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    permissions = EXCLUDED.permissions,
    is_system_role = EXCLUDED.is_system_role;

-- Finance Manager Role
INSERT INTO company_roles (
    id,
    tenant_id,
    role_name,
    display_name,
    description,
    permissions,
    is_system_role,
    created_at
) VALUES
(
    gen_random_uuid()::text,
    'default-tenant',
    'finance_manager',
    'Finance Manager',
    'Manages all financial operations, payments, and billing',
    '{
        "invoices": ["read", "write", "delete"],
        "payments": ["read", "write", "approve"],
        "expenses": ["read", "write"],
        "reports": ["read"],
        "customers": ["read"],
        "pricing": ["read", "write"],
        "documents": ["read", "write"]
    }'::jsonb,
    true,
    CURRENT_TIMESTAMP
)
ON CONFLICT (tenant_id, role_name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    permissions = EXCLUDED.permissions,
    is_system_role = EXCLUDED.is_system_role;

-- Branch Manager Role
INSERT INTO company_roles (
    id,
    tenant_id,
    role_name,
    display_name,
    description,
    permissions,
    is_system_role,
    created_at
) VALUES
(
    gen_random_uuid()::text,
    'default-tenant',
    'branch_manager',
    'Branch Manager',
    'Manages branch operations, staff, and local customers',
    '{
        "branches": ["read", "write"],
        "customers": ["read", "write", "delete"],
        "products": ["read"],
        "vehicles": ["read"],
        "employees": ["read", "write"],
        "orders": ["read", "write"],
        "reports": ["read"],
        "inventory": ["read", "write"],
        "documents": ["read", "write"]
    }'::jsonb,
    true,
    CURRENT_TIMESTAMP
)
ON CONFLICT (tenant_id, role_name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    permissions = EXCLUDED.permissions,
    is_system_role = EXCLUDED.is_system_role;

-- Logistics Manager Role
INSERT INTO company_roles (
    id,
    tenant_id,
    role_name,
    display_name,
    description,
    permissions,
    is_system_role,
    created_at
) VALUES
(
    gen_random_uuid()::text,
    'default-tenant',
    'logistics_manager',
    'Logistics Manager',
    'Manages transportation, routing, and driver assignments',
    '{
        "vehicles": ["read", "write"],
        "drivers": ["read", "write"],
        "routes": ["read", "write", "delete"],
        "orders": ["read", "write"],
        "trips": ["read", "write", "delete"],
        "reports": ["read"],
        "tracking": ["read", "write"],
        "documents": ["read", "write"]
    }'::jsonb,
    true,
    CURRENT_TIMESTAMP
)
ON CONFLICT (tenant_id, role_name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    permissions = EXCLUDED.permissions,
    is_system_role = EXCLUDED.is_system_role;

-- Driver Role
INSERT INTO company_roles (
    id,
    tenant_id,
    role_name,
    display_name,
    description,
    permissions,
    is_system_role,
    created_at
) VALUES
(
    gen_random_uuid()::text,
    'default-tenant',
    'driver',
    'Driver',
    'Handles vehicle operations and deliveries',
    '{
        "trips": ["read"],
        "vehicles": ["read"],
        "orders": ["read"],
        "tracking": ["read", "write"],
        "documents": ["read", "write"],
        "profile": ["read", "write"]
    }'::jsonb,
    true,
    CURRENT_TIMESTAMP
)
ON CONFLICT (tenant_id, role_name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    permissions = EXCLUDED.permissions,
    is_system_role = EXCLUDED.is_system_role;