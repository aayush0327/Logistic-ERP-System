-- Default Company Roles Insert Script
-- This script inserts the default company roles into the company_roles table
-- Note: This file is deprecated - use 003_fix_roles_migration.sql instead
-- Run the fix migration to handle existing tables properly

-- Insert roles for other tenants (template)
-- These can be duplicated for new tenants when they are created

-- Example of creating roles for a new tenant (commented out)
/*
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
    'NEW-TENANT-ID',
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
    }',
    true,
    CURRENT_TIMESTAMP
),

-- Finance Manager Role
(
    gen_random_uuid()::text,
    'NEW-TENANT-ID',
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
    }',
    true,
    CURRENT_TIMESTAMP
),

-- Branch Manager Role
(
    gen_random_uuid()::text,
    'NEW-TENANT-ID',
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
    }',
    true,
    CURRENT_TIMESTAMP
),

-- Logistics Manager Role
(
    gen_random_uuid()::text,
    'NEW-TENANT-ID',
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
    }',
    true,
    CURRENT_TIMESTAMP
),

-- Driver Role
(
    gen_random_uuid()::text,
    'NEW-TENANT-ID',
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
    }',
    true,
    CURRENT_TIMESTAMP
);
*/