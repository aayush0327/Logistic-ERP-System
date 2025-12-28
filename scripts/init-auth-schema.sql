-- Auth Service Database Schema Initialization
-- This file will be executed after the database is created

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable Row Level Security
ALTER DATABASE postgres SET row_security = on;

-- Create tenants table (without admin_id constraint initially to avoid circular reference)
CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(255) PRIMARY KEY DEFAULT uuid_generate_v4 (),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE,
    settings TEXT,
    is_active BOOLEAN DEFAULT true,
    admin_id VARCHAR(255) UNIQUE,
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY, -- Changed to auto-increment integer
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT false,
    tenant_id VARCHAR(255) NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id VARCHAR(255) PRIMARY KEY DEFAULT uuid_generate_v4 (),
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (resource, action)
);

-- Create role_permissions association table
CREATE TABLE IF NOT EXISTS role_permissions (
    id VARCHAR(255) PRIMARY KEY DEFAULT uuid_generate_v4 (),
    role_id INTEGER NOT NULL REFERENCES roles (id) ON DELETE CASCADE,
    permission_id VARCHAR(255) NOT NULL REFERENCES permissions (id) ON DELETE CASCADE,
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (role_id, permission_id)
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY DEFAULT uuid_generate_v4 (),
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    is_superuser BOOLEAN DEFAULT false,
    last_login TIMESTAMP
    WITH
        TIME ZONE,
        login_attempts INTEGER DEFAULT 0,
        locked_until TIMESTAMP
    WITH
        TIME ZONE,
        created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        tenant_id VARCHAR(255) REFERENCES tenants (id), -- Nullable for super admins
        role_id INTEGER NOT NULL REFERENCES roles (id) -- Changed to INTEGER
);

-- Add unique constraint for email (global uniqueness)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users (email);

-- Add unique constraint for email per tenant (for tenant-specific users)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_tenant ON users (email, tenant_id) WHERE tenant_id IS NOT NULL;

-- Create refresh_tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id VARCHAR(255) PRIMARY KEY DEFAULT uuid_generate_v4 (),
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP
    WITH
        TIME ZONE NOT NULL,
        is_revoked BOOLEAN DEFAULT false,
        created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        revoked_at TIMESTAMP
    WITH
        TIME ZONE,
        user_id VARCHAR(255) NOT NULL REFERENCES users (id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users (tenant_id);

CREATE INDEX IF NOT EXISTS idx_users_role_id ON users (role_id);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens (user_id);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens (token_hash);

CREATE INDEX IF NOT EXISTS idx_roles_tenant_id ON roles (tenant_id);

-- Create function to automatically update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to update updated_at
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default tenant
INSERT INTO
    tenants (id, name, domain, is_active)
VALUES (
        '550e8400-e29b-41d4-a716-446655440000',
        'Default Organization',
        'demo.logistics-erp.com',
        true
    ) ON CONFLICT (id) DO NOTHING;

-- Insert default roles (using integer IDs)
INSERT INTO
    roles (
        name,
        description,
        tenant_id,
        is_system
    )
VALUES (
        'Super Admin',
        'System administrator with all privileges',
        '550e8400-e29b-41d4-a716-446655440000',
        true
    ),
    (
        'Admin',
        'Organization administrator',
        '550e8400-e29b-41d4-a716-446655440000',
        true
    ),
    (
        'Branch Manager',
        'Manages branch operations and orders',
        '550e8400-e29b-41d4-a716-446655440000',
        false
    ),
    (
        'Finance Manager',
        'Handles financial approvals and billing',
        '550e8400-e29b-41d4-a716-446655440000',
        false
    ),
    (
        'Logistics Manager',
        'Manages logistics and transportation',
        '550e8400-e29b-41d4-a716-446655440000',
        false
    ),
    (
        'Driver',
        'Vehicle driver for deliveries',
        '550e8400-e29b-41d4-a716-446655440000',
        false
    ),
    (
        'User',
        'Regular user',
        '550e8400-e29b-41d4-a716-446655440000',
        false
    ) ON CONFLICT DO NOTHING;

-- Insert default permissions
INSERT INTO
    permissions (resource, action, description)
VALUES
    -- User management permissions
    (
        'users',
        'create',
        'Create new users'
    ),
    (
        'users',
        'read',
        'View user information'
    ),
    (
        'users',
        'read_own',
        'View own user information'
    ),
    (
        'users',
        'read_all',
        'View all users information'
    ),
    (
        'users',
        'update',
        'Update user information'
    ),
    (
        'users',
        'update_own',
        'Update own user information'
    ),
    (
        'users',
        'delete',
        'Delete users'
    ),
    (
        'users',
        'manage_all',
        'Full user management'
    ),
    (
        'users',
        'invite',
        'Invite new users'
    ),
    (
        'users',
        'activate',
        'Activate or deactivate users'
    ),

-- Role management permissions
(
    'roles',
    'create',
    'Create new roles'
),
(
    'roles',
    'read',
    'View role information'
),
(
    'roles',
    'update',
    'Update role information'
),
(
    'roles',
    'delete',
    'Delete roles'
),
(
    'roles',
    'assign',
    'Assign roles to users'
),

-- Permission management permissions
(
    'permissions',
    'read',
    'View permission information'
),
(
    'permissions',
    'assign',
    'Assign permissions to roles'
),

-- Tenant management permissions
(
    'tenants',
    'create',
    'Create new tenants'
),
(
    'tenants',
    'read',
    'View tenant information'
),
(
    'tenants',
    'update',
    'Update tenant information'
),
(
    'tenants',
    'delete',
    'Delete tenants'
),
(
    'tenants',
    'manage_own',
    'Manage own tenant'
),
(
    'tenants',
    'manage_all',
    'Manage all tenants'
),

-- Company/Branch management permissions
(
    'branches',
    'create',
    'Create new branches'
),
(
    'branches',
    'read',
    'View branch information'
),
(
    'branches',
    'read_all',
    'View all branches'
),
(
    'branches',
    'read_own',
    'View own assigned branches'
),
(
    'branches',
    'update',
    'Update branch information'
),
(
    'branches',
    'update_own',
    'Update own assigned branches'
),
(
    'branches',
    'delete',
    'Delete branches'
),
(
    'branches',
    'manage_own',
    'Manage own assigned branches'
),
(
    'branches',
    'manage_all',
    'Manage all branches'
),

-- Order management permissions
(
    'orders',
    'create',
    'Create new orders'
),
(
    'orders',
    'read',
    'View order information'
),
(
    'orders',
    'read_own',
    'View own orders'
),
(
    'orders',
    'read_all',
    'View all orders'
),
(
    'orders',
    'update',
    'Update order information'
),
(
    'orders',
    'update_own',
    'Update own orders'
),
(
    'orders',
    'delete',
    'Delete orders'
),
(
    'orders',
    'delete_own',
    'Delete own orders'
),
(
    'orders',
    'cancel',
    'Cancel orders'
),
(
    'orders',
    'status_update',
    'Update order status'
),
(
    'orders',
    'priority_update',
    'Update order priority'
),
(
    'orders',
    'approve_finance',
    'Approve orders in finance'
),
(
    'orders',
    'approve_logistics',
    'Approve orders in logistics'
),
(
    'orders',
    'approve_any',
    'Approve orders in any department'
),
(
    'orders',
    'bulk_approve',
    'Bulk approve orders'
),
(
    'orders',
    'financial_view',
    'View financial information'
),
(
    'orders',
    'financial_edit',
    'Edit financial information'
),
(
    'orders',
    'payment_process',
    'Process payments'
),
(
    'orders',
    'refund_process',
    'Process refunds'
),
(
    'orders',
    'logistics_view',
    'View logistics information'
),
(
    'orders',
    'logistics_edit',
    'Edit logistics information'
),
(
    'orders',
    'shipment_create',
    'Create shipments'
),
(
    'orders',
    'tracking_update',
    'Update tracking information'
),
(
    'orders',
    'delivery_confirm',
    'Confirm deliveries'
),
(
    'orders',
    'export',
    'Export orders'
),
(
    'orders',
    'import',
    'Import orders'
),

-- Order document permissions
(
    'order_documents',
    'upload',
    'Upload order documents'
),
(
    'order_documents',
    'read',
    'View order documents'
),
(
    'order_documents',
    'read_own',
    'View own order documents'
),
(
    'order_documents',
    'read_all',
    'View all order documents'
),
(
    'order_documents',
    'update',
    'Update order documents'
),
(
    'order_documents',
    'update_own',
    'Update own order documents'
),
(
    'order_documents',
    'delete',
    'Delete order documents'
),
(
    'order_documents',
    'delete_own',
    'Delete own order documents'
),
(
    'order_documents',
    'verify',
    'Verify order documents'
),
(
    'order_documents',
    'download',
    'Download order documents'
),

-- Inventory management permissions (WMS)
(
    'wms',
    'create',
    'Create inventory items'
),
(
    'wms',
    'read',
    'View inventory information'
),
(
    'wms',
    'read_all',
    'View all inventory'
),
(
    'wms',
    'update',
    'Update inventory information'
),
(
    'wms',
    'delete',
    'Delete inventory items'
),
(
    'wms',
    'adjust',
    'Adjust inventory levels'
),

-- Branch management permissions
(
    'branches',
    'create',
    'Create new branches'
),
(
    'branches',
    'read',
    'View branch information'
),
(
    'branches',
    'read_own',
    'View own branch information'
),
(
    'branches',
    'read_all',
    'View all branches'
),
(
    'branches',
    'update',
    'Update branch information'
),
(
    'branches',
    'delete',
    'Delete branches'
),
(
    'branches',
    'manage_all',
    'Full branch management'
),
(
    'branches',
    'manage_own',
    'Manage own branch'
),

-- Transportation management permissions (TMS)
-- Trip specific permissions
(
    'trips',
    'create',
    'Create new trips'
),
(
    'trips',
    'read',
    'Read own trips'
),
(
    'trips',
    'read_all',
    'Read all trips across branches'
),
(
    'trips',
    'update',
    'Update existing trips'
),
(
    'trips',
    'delete',
    'Delete trips'
),
(
    'trips',
    'assign',
    'Assign orders to trips'
),
(
    'trips',
    'track',
    'Track trip status'
),
-- Order specific permissions for TMS
(
    'orders',
    'split',
    'Split orders'
),
(
    'orders',
    'reassign',
    'Reassign orders to different trips'
),
-- Resource permissions
(
    'resources',
    'read',
    'Read own resources (trucks, drivers)'
),
(
    'resources',
    'read_all',
    'Read all resources across branches'
),
-- Driver permissions
(
    'drivers',
    'assign',
    'Assign drivers to trips'
),
(
    'drivers',
    'update',
    'Update driver information'
),
-- Driver Service permissions
(
    'driver',
    'read',
    'Read driver information and trips'
),
(
    'driver',
    'read_all',
    'Read all driver information and trips'
),
(
    'driver',
    'update',
    'Update driver information and trip statuses'
),
-- Vehicle permissions
(
    'vehicles',
    'track',
    'Track vehicle location'
),
(
    'vehicles',
    'update',
    'Update vehicle information'
),
-- Route permissions
(
    'routes',
    'create',
    'Create new routes'
),
(
    'routes',
    'optimize',
    'Optimize routes'
),
(
    'routes',
    'update',
    'Update existing routes'
),
-- Schedule permissions
(
    'schedules',
    'read',
    'Read schedule information'
),
(
    'schedules',
    'update',
    'Update schedules'
),

-- Billing permissions
(
    'billing',
    'create',
    'Create billing entries'
),
(
    'billing',
    'read',
    'View billing information'
),
(
    'billing',
    'read_all',
    'View all billing'
),
(
    'billing',
    'update',
    'Update billing information'
),
(
    'billing',
    'delete',
    'Delete billing entries'
),

-- Customer management permissions
(
    'customers',
    'create',
    'Create new customers'
),
(
    'customers',
    'read',
    'View customer information'
),
(
    'customers',
    'read_all',
    'View all customers'
),
(
    'customers',
    'read_own',
    'View own assigned customers'
),
(
    'customers',
    'update',
    'Update customer information'
),
(
    'customers',
    'update_own',
    'Update own assigned customers'
),
(
    'customers',
    'delete',
    'Delete customers'
),

-- Supplier management permissions
(
    'suppliers',
    'create',
    'Create new suppliers'
),
(
    'suppliers',
    'read',
    'View supplier information'
),
(
    'suppliers',
    'read_all',
    'View all suppliers'
),
(
    'suppliers',
    'update',
    'Update supplier information'
),
(
    'suppliers',
    'delete',
    'Delete suppliers'
),

-- Shipping management permissions
(
    'shipping',
    'create',
    'Create shipping records'
),
(
    'shipping',
    'read',
    'View shipping information'
),
(
    'shipping',
    'read_all',
    'View all shipping records'
),
(
    'shipping',
    'update',
    'Update shipping information'
),
(
    'shipping',
    'delete',
    'Delete shipping records'
),

-- Vehicle management permissions
(
    'vehicles',
    'create',
    'Create new vehicles'
),
(
    'vehicles',
    'read',
    'View vehicle information'
),
(
    'vehicles',
    'read_all',
    'View all vehicles'
),
(
    'vehicles',
    'update',
    'Update vehicle information'
),
(
    'vehicles',
    'delete',
    'Delete vehicles'
),
(
    'vehicles',
    'assign',
    'Assign vehicles to drivers/routes'
),
(
    'vehicles',
    'maintenance',
    'Manage vehicle maintenance'
),

-- Product management permissions
(
    'products',
    'create',
    'Create new products'
),
(
    'products',
    'read',
    'View product information'
),
(
    'products',
    'read_all',
    'View all products'
),
(
    'products',
    'update',
    'Update product information'
),
(
    'products',
    'delete',
    'Delete products'
),
(
    'products',
    'stock_adjust',
    'Adjust product stock levels'
),
(
    'products',
    'pricing_update',
    'Update product pricing'
),

-- Product category permissions
(
    'product_categories',
    'create',
    'Create product categories'
),
(
    'product_categories',
    'read',
    'View product categories'
),
(
    'product_categories',
    'read_all',
    'View all product categories'
),
(
    'product_categories',
    'update',
    'Update product categories'
),
(
    'product_categories',
    'delete',
    'Delete product categories'
),

-- Profile management permissions
(
    'profiles',
    'read',
    'View profile information'
),
(
    'profiles',
    'read_own',
    'View own profile'
),
(
    'profiles',
    'create',
    'Create profiles'
),
(
    'profiles',
    'update',
    'Update profiles'
),
(
    'profiles',
    'update_own',
    'Update own profile'
),
(
    'profiles',
    'delete',
    'Delete profiles'
),
(
    'profiles',
    'upload_avatar',
    'Upload profile avatar'
),

-- Company reports permissions
(
    'company_reports',
    'read',
    'View company reports'
),
(
    'company_reports',
    'read_own',
    'View own company reports'
),
(
    'company_reports',
    'read_all',
    'View all company reports'
),
(
    'company_reports',
    'export',
    'Export company reports'
),

-- Reporting permissions
(
    'reports',
    'read',
    'View reports'
),
(
    'reports',
    'read_all',
    'View all reports'
),
(
    'reports',
    'create',
    'Create reports'
),
(
    'reports',
    'export',
    'Export reports'
),

-- System permissions
(
    'system',
    'read',
    'View system information'
),
(
    'system',
    'admin',
    'System administration'
),
(
    'system',
    'logs',
    'View system logs'
),
(
    'system',
    'backup',
    'Create system backups'
),
(
    'system',
    'restore',
    'Restore system backups'
),

-- Dashboard permissions
(
    'dashboard',
    'read',
    'View dashboard'
),
(
    'dashboard',
    'read_own',
    'View own dashboard'
),
(
    'dashboard',
    'read_all',
    'View all dashboards'
),

-- Order documents permissions
(
    'order_documents',
    'create',
    'Create order documents'
),
(
    'order_documents',
    'read',
    'View order documents'
),
(
    'order_documents',
    'read_all',
    'View all order documents'
),
(
    'order_documents',
    'read_own',
    'View own order documents'
),
(
    'order_documents',
    'update',
    'Update order documents'
),
(
    'order_documents',
    'delete',
    'Delete order documents'
),
(
    'order_documents',
    'download',
    'Download order documents'
),
(
    'order_documents',
    'upload',
    'Upload order documents'
),

-- Additional orders permissions (some may be specific to logistics operations)
(
    'orders',
    'delivery_confirm',
    'Confirm order delivery'
),
(
    'orders',
    'export',
    'Export orders'
),
(
    'orders',
    'import',
    'Import orders'
),
(
    'orders',
    'logistics_edit',
    'Edit logistics information'
),
(
    'orders',
    'logistics_view',
    'View logistics information'
),
(
    'orders',
    'payment_process',
    'Process order payments'
),
(
    'orders',
    'refund_process',
    'Process order refunds'
),
(
    'orders',
    'shipment_create',
    'Create shipments'
),
(
    'orders',
    'tracking_update',
    'Update order tracking'
),

-- Finance Service permissions
(
    'finance',
    'read',
    'View finance information and pending approvals'
),
(
    'finance',
    'approve',
    'Approve or reject orders in finance'
),
(
    'finance',
    'approve_bulk',
    'Bulk approve or reject orders in finance'
),
(
    'finance',
    'reports',
    'View finance reports and dashboard'
),
(
    'finance',
    'export',
    'Export finance data'
),

-- Superuser permission
( 'superuser', 'access', 'Full system access' ) ON CONFLICT (resource, action) DO NOTHING;

-- Assign all permissions to super admin role (ID = 1)
INSERT INTO
    role_permissions (role_id, permission_id)
SELECT 1, id
FROM permissions ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grant comprehensive permissions to tenant admin role (role_id=2)
-- Order Management Permissions for tenant admin
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT 2, p.id, NOW()
FROM permissions p
WHERE p.resource = 'orders'
  AND p.action IN ('create', 'read', 'read_own', 'update', 'update_own', 'delete', 'delete_own',
                   'cancel', 'status_update', 'priority_update', 'assign',
                   'approve_finance', 'approve_logistics', 'approve_any', 'bulk_approve',
                   'financial_view', 'financial_edit', 'payment_process', 'refund_process', 'invoice_create',
                   'logistics_view', 'logistics_edit', 'shipment_create', 'tracking_update', 'delivery_confirm',
                   'export', 'import', 'bulk_create', 'bulk_update', 'bulk_cancel', 'bulk_delete',
                   'split', 'reassign')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Order Document Permissions
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT 2, p.id, NOW()
FROM permissions p
WHERE p.resource = 'order_documents'
  AND p.action IN ('upload', 'read', 'read_own', 'update', 'update_own', 'delete', 'delete_own',
                   'verify', 'download', 'create', 'read_all')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Company/Branch Management Permissions
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT 2, p.id, NOW()
FROM permissions p
WHERE p.resource = 'branches'
  AND p.action IN ('create', 'read', 'read_own', 'update', 'delete', 'manage_all', 'manage_own', 'read_all')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Customer Management Permissions
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT 2, p.id, NOW()
FROM permissions p
WHERE p.resource = 'customers'
  AND p.action IN ('create', 'read', 'read_own', 'update', 'delete', 'read_all')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Product Management Permissions
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT 2, p.id, NOW()
FROM permissions p
WHERE p.resource = 'products'
  AND p.action IN ('create', 'read', 'update', 'delete', 'stock_adjust', 'read_all', 'manage_all', 'pricing_update')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Vehicle Management Permissions
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT 2, p.id, NOW()
FROM permissions p
WHERE p.resource = 'vehicles'
  AND p.action IN ('create', 'read', 'update', 'delete', 'assign', 'track', 'update_mileage',
                   'read_own', 'update_own', 'delete_own', 'read_all', 'maintenance')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- TMS/Trip Management Permissions
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT 2, p.id, NOW()
FROM permissions p
WHERE p.resource = 'trips'
  AND p.action IN ('create', 'read', 'read_all', 'update', 'delete', 'assign', 'track')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Resource Management Permissions
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT 2, p.id, NOW()
FROM permissions p
WHERE p.resource IN ('resources', 'drivers', 'driver')
  AND p.action IN ('read', 'read_all', 'assign', 'update')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Route Management Permissions
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT 2, p.id, NOW()
FROM permissions p
WHERE p.resource = 'routes'
  AND p.action IN ('create', 'optimize', 'update')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Schedule Management Permissions
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT 2, p.id, NOW()
FROM permissions p
WHERE p.resource = 'schedules'
  AND p.action IN ('read', 'update')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Report and Analytics Permissions
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT 2, p.id, NOW()
FROM permissions p
WHERE p.resource IN ('reports', 'analytics', 'company_reports')
  AND p.action IN ('read', 'export', 'financial', 'operational', 'read_all', 'create')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Additional system permissions for tenant admin
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT 2, p.id, NOW()
FROM permissions p
WHERE p.resource IN ('users', 'roles', 'tenants', 'wms', 'billing', 'suppliers', 'shipping',
                     'product_categories', 'dashboard', 'system', 'permissions', 'finance', 'profiles')
  AND p.action IN ('create', 'read', 'read_all', 'update', 'delete', 'manage_all', 'manage_own',
                   'assign', 'admin', 'logs', 'backup', 'restore', 'read_own', 'update_own',
                   'approve', 'approve_bulk', 'reports', 'export', 'invite', 'activate', 'upload_avatar')
  AND p.resource != 'orders'  -- Exclude orders as they are handled above
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Create wildcard permissions for full access to major resources
INSERT INTO permissions (id, resource, action, description, created_at)
VALUES
    ('tenant-admin-orders-all', 'orders', '*', 'Tenant admin has full access to all order operations', NOW()),
    ('tenant-admin-products-all', 'products', '*', 'Tenant admin has full access to all product operations', NOW()),
    ('tenant-admin-vehicles-all', 'vehicles', '*', 'Tenant admin has full access to all vehicle operations', NOW()),
    ('tenant-admin-customers-all', 'customers', '*', 'Tenant admin has full access to all customer operations', NOW()),
    ('tenant-admin-branches-all', 'branches', '*', 'Tenant admin has full access to all branch operations', NOW())
ON CONFLICT (id) DO NOTHING;

-- Grant wildcard permissions to tenant admin
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT 2, p.id, NOW()
FROM permissions p
WHERE p.id IN ('tenant-admin-orders-all', 'tenant-admin-products-all',
                'tenant-admin-vehicles-all', 'tenant-admin-customers-all',
                'tenant-admin-branches-all')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign branch manager permissions (ID = 3) - Full CRUD access to orders
INSERT INTO
    role_permissions (role_id, permission_id)
VALUES
    -- Order management - Full CRUD
    (
        3,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'create'
        )
    ),
    (
        3,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'read'
        )
    ),
    (
        3,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'read_all'
        )
    ),
    (
        3,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'update'
        )
    ),
    (
        3,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'delete'
        )
    ),
    (
        3,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'cancel'
        )
    ),
    (
        3,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'status_update'
        )
    ),
    (
        3,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'priority_update'
        )
    ),
    (
        3,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'export'
        )
    ),
    -- Order documents
    (
        3,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'order_documents'
                AND action = 'upload'
        )
    ),
    (
        3,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'order_documents'
                AND action = 'read'
        )
    ),
    (
        3,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'order_documents'
                AND action = 'read_all'
        )
    ),
    (
        3,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'order_documents'
                AND action = 'update'
        )
    ),
    (
        3,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'order_documents'
                AND action = 'delete'
        )
    ),
    (
        3,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'order_documents'
                AND action = 'download'
        )
    ),
    -- Branch management
    (
        3,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'branches'
                AND action = 'read'
        )
    ),
    (
        3,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'branches'
                AND action = 'read_all'
        )
    ),
    (
        3,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'branches'
                AND action = 'update'
        )
    ),
    (
        3,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'branches'
                AND action = 'manage_own'
        )
    ),
    -- Customer management
    (
        3,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'customers'
                AND action = 'read'
        )
    ),
    (
        3,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'customers'
                AND action = 'read_all'
        )
    ),
    (
        3,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'customers'
                AND action = 'create'
        )
    ),
    (
        3,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'customers'
                AND action = 'update'
        )
    ),
    -- Vehicle management
    (
        3,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'vehicles'
                AND action = 'read'
        )
    ),
    (
        3,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'vehicles'
                AND action = 'read_all'
        )
    ),
    (
        3,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'vehicles'
                AND action = 'assign'
        )
    ),
    -- Reports
    (
        3,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'company_reports'
                AND action = 'read'
        )
    ),
    (
        3,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'company_reports'
                AND action = 'export'
        )
    ),
    (
        3,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'reports'
                AND action = 'read'
        )
    ),
    (
        3,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'dashboard'
                AND action = 'read'
        )
    ),
    -- Finance Service permissions for Branch Manager (read and reports only)
    (
        3,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'finance'
                AND action = 'read'
        )
    ),
    (
        3,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'finance'
                AND action = 'reports'
        )
    ),
    (
        3,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'products'
                AND action = 'read'
        )
    ),
    (
        3,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'products'
                AND action = 'read_all'
        )
    ),
    (
        3,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'branches'
                AND action = 'read'
        )
    ),
    (
        3,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'branches'
                AND action = 'read_all'
        )
    ) ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign finance manager permissions (ID = 4)
INSERT INTO
    role_permissions (role_id, permission_id)
VALUES
    -- Order management - Focus on financial aspects
    (
        4,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'read'
        )
    ),
    (
        4,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'read_all'
        )
    ),
    (
        4,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'update'
        )
    ),
    (
        4,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'approve_finance'
        )
    ),
    (
        4,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'approve_any'
        )
    ),
    (
        4,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'bulk_approve'
        )
    ),
    (
        4,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'financial_view'
        )
    ),
    (
        4,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'financial_edit'
        )
    ),
    (
        4,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'payment_process'
        )
    ),
    (
        4,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'refund_process'
        )
    ),
    (
        4,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'export'
        )
    ),
    -- Order documents
    (
        4,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'order_documents'
                AND action = 'read'
        )
    ),
    (
        4,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'order_documents'
                AND action = 'read_all'
        )
    ),
    (
        4,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'order_documents'
                AND action = 'verify'
        )
    ),
    (
        4,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'order_documents'
                AND action = 'download'
        )
    ),
    -- Billing
    (
        4,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'billing'
                AND action = 'read'
        )
    ),
    (
        4,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'billing'
                AND action = 'read_all'
        )
    ),
    (
        4,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'billing'
                AND action = 'create'
        )
    ),
    (
        4,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'billing'
                AND action = 'update'
        )
    ),
    -- Reports
    (
        4,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'company_reports'
                AND action = 'read'
        )
    ),
    (
        4,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'company_reports'
                AND action = 'read_all'
        )
    ),
    (
        4,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'company_reports'
                AND action = 'export'
        )
    ),
    (
        4,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'dashboard'
                AND action = 'read'
        )
    ),
    -- Finance Service permissions for Finance Manager
    (
        4,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'finance'
                AND action = 'read'
        )
    ),
    (
        4,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'finance'
                AND action = 'approve'
        )
    ),
    (
        4,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'finance'
                AND action = 'approve_bulk'
        )
    ),
    (
        4,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'finance'
                AND action = 'reports'
        )
    ),
    (
        4,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'finance'
                AND action = 'export'
        )
    ),
    -- Customer permissions for Finance Manager
    (
        4,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'customers'
                AND action = 'read'
        )
    ),
    (
        4,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'customers'
                AND action = 'read_all'
        )
    ),
    -- Branch permissions for Finance Manager (needed for role-based order filtering)
    (
        4,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'branches'
                AND action = 'read'
        )
    ),
    (
        4,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'branches'
                AND action = 'read_all'
        )
    ) ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign logistics manager permissions (ID = 5)
INSERT INTO
    role_permissions (role_id, permission_id)
VALUES
    -- Order management - Focus on logistics aspects
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'read'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'read_all'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'update'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'approve_logistics'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'approve_any'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'bulk_approve'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'logistics_view'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'logistics_edit'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'shipment_create'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'tracking_update'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'delivery_confirm'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'status_update'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'export'
        )
    ),
    -- Order documents
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'order_documents'
                AND action = 'read'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'order_documents'
                AND action = 'read_all'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'order_documents'
                AND action = 'verify'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'order_documents'
                AND action = 'download'
        )
    ),
    -- Transportation management (TMS) - Manager role
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'trips'
                AND action = 'create'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'trips'
                AND action = 'read'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'trips'
                AND action = 'read_all'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'trips'
                AND action = 'update'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'trips'
                AND action = 'assign'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'trips'
                AND action = 'track'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'split'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'reassign'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'resources'
                AND action = 'read'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'resources'
                AND action = 'read_all'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'drivers'
                AND action = 'assign'
        )
    ),
    -- Driver Service permissions
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'driver'
                AND action = 'read'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'driver'
                AND action = 'read_all'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'driver'
                AND action = 'update'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'vehicles'
                AND action = 'track'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'routes'
                AND action = 'create'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'routes'
                AND action = 'optimize'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'schedules'
                AND action = 'read'
        )
    ),
    -- Shipping management
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'shipping'
                AND action = 'read'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'shipping'
                AND action = 'read_all'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'shipping'
                AND action = 'create'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'shipping'
                AND action = 'update'
        )
    ),
    -- Vehicle management
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'vehicles'
                AND action = 'read'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'vehicles'
                AND action = 'read_all'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'vehicles'
                AND action = 'assign'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'vehicles'
                AND action = 'maintenance'
        )
    ),
    -- Reports
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'company_reports'
                AND action = 'read'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'company_reports'
                AND action = 'read_all'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'company_reports'
                AND action = 'export'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'dashboard'
                AND action = 'read'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'products'
                AND action = 'read'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'products'
                AND action = 'read_all'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'customers'
                AND action = 'read'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'customers'
                AND action = 'read_all'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'branches'
                AND action = 'read'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'branches'
                AND action = 'read_all'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'drivers'
                AND action = 'read'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'drivers'
                AND action = 'read_all'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'users'
                AND action = 'read'
        )
    ),
    (
        5,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'users'
                AND action = 'read_all'
        )
    ) ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign driver permissions (ID = 6)
INSERT INTO
    role_permissions (role_id, permission_id)
VALUES
    -- Order management - Limited to assigned orders
    (
        6,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'read'
        )
    ),
    (
        6,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'tracking_update'
        )
    ),
    (
        6,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'delivery_confirm'
        )
    ),
    (
        6,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'logistics_view'
        )
    ),
    -- Order documents
    (
        6,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'order_documents'
                AND action = 'read'
        )
    ),
    (
        6,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'order_documents'
                AND action = 'download'
        )
    ),
    -- Vehicle management - Only assigned vehicles
    (
        6,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'vehicles'
                AND action = 'read'
        )
    ),
    -- Shipping
    (
        6,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'shipping'
                AND action = 'read'
        )
    ),
    (
        6,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'shipping'
                AND action = 'update'
        )
    ),
    -- Driver Service permissions
    (
        6,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'driver'
                AND action = 'read'
        )
    ),
    (
        6,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'driver'
                AND action = 'update'
        )
    ),
    -- Dashboard
    (
        6,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'dashboard'
                AND action = 'read'
        )
    ) ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign user permissions (ID = 7) - Regular users
INSERT INTO
    role_permissions (role_id, permission_id)
VALUES (
        7,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'users'
                AND action = 'read_own'
        )
    ),
    (
        7,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'users'
                AND action = 'update_own'
        )
    ),
    (
        7,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'read'
        )
    ),
    (
        7,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'read_own'
        )
    ),
    (
        7,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'update_own'
        )
    ),
    (
        7,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'create'
        )
    ),
    (
        7,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'orders'
                AND action = 'cancel'
        )
    ),
    -- Order documents for own orders
    (
        7,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'order_documents'
                AND action = 'read_own'
        )
    ),
    (
        7,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'order_documents'
                AND action = 'upload'
        )
    ),
    (
        7,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'order_documents'
                AND action = 'update_own'
        )
    ),
    (
        7,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'order_documents'
                AND action = 'delete_own'
        )
    ),
    (
        7,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'order_documents'
                AND action = 'download'
        )
    ),
    -- Basic company permissions for users
    (
        7,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'branches'
                AND action = 'read'
        )
    ),
    (
        7,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'customers'
                AND action = 'read'
        )
    ),
    (
        7,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'vehicles'
                AND action = 'read'
        )
    ),
    (
        7,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'products'
                AND action = 'read'
        )
    ),
    (
        7,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'product_categories'
                AND action = 'read'
        )
    ),
    (
        7,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'company_reports'
                AND action = 'read_own'
        )
    ),
    (
        7,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'dashboard'
                AND action = 'read'
        )
    ),
    -- Finance Service permissions for regular User (read only)
    (
        7,
        (
            SELECT id
            FROM permissions
            WHERE
                resource = 'finance'
                AND action = 'read'
        )
    ) ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Create default super admin user (password: admin123) - NOT assigned to any tenant
-- NOTE: This is a default password that should be changed immediately after first login
-- Password hash computed with JWT_SECRET: eyJhbGciOiJIUzI1NiJ9.eyJSb2xlIjoiQWRtaW4iLCJJc3N1ZXIiOiJJc3N1ZXIiLCJVc2VybmFtZSI6IkphdmFJblVzZSIsImV4cCI6MTc2NTY5MTkzMywiaWF0IjoxNzY1NjkxOTMzfQ.IR5TvLwqTpsCqR2gRa7ApNoTgfxPAjUh_LQ9JmgoXck
INSERT INTO
    users (
        id,
        email,
        password_hash,
        first_name,
        last_name,
        is_active,
        is_superuser,
        tenant_id,
        role_id
    )
VALUES (
        'a5dc781f-9e43-4863-9e35-8772b26a7b77',
        'admin@example.com',
        'aa2573da8923d5d34ffd1fba1e6a2f34af71cb77e039da7e760b0b6242a3ca00',
        'System',
        'Administrator',
        true,
        true,
        NULL,
        1
    ) ON CONFLICT (id) DO NOTHING;

-- -- Create default demo admin user (password: admin123)
-- INSERT INTO users (id, email, password_hash, first_name, last_name, is_active, is_superuser, tenant_id, role_id) VALUES
--     ('75267200-9b37-49a5-9ffa-4b7e1f3aba51', 'admin@example.com', '1baedde8092024d84b5e24e0e18f0202cf493c98e45916ac53a751d7e516a1fb', 'Demo', 'Admin', true, false, '550e8400-e29b-41d4-a716-446655440000', 2)
-- ON CONFLICT (id) DO NOTHING;

-- Create default demo branch manager user (password: branch123)
INSERT INTO
    users (
        id,
        email,
        password_hash,
        first_name,
        last_name,
        is_active,
        is_superuser,
        tenant_id,
        role_id
    )
VALUES (
        '5fcd2919-1b77-4c88-b60d-0de84ea3c512',
        'branch.manager@example.com',
        '7c222fb2927d828af22f592134e8932480637c0d495012b26e415d34b9e124cb',
        'Demo',
        'Branch Manager',
        true,
        false,
        '550e8400-e29b-41d4-a716-446655440000',
        3
    ) ON CONFLICT (id) DO NOTHING;

-- Create default demo finance manager user (password: finance123)
INSERT INTO
    users (
        id,
        email,
        password_hash,
        first_name,
        last_name,
        is_active,
        is_superuser,
        tenant_id,
        role_id
    )
VALUES (
        'a7dc781f-9e43-4863-9e35-8772b26a7b77',
        'finance.manager@example.com',
        'b1cedde8092024d84b5e24e0e18f0202cf493c98e45916ac53a751d7e516a1fc',
        'Demo',
        'Finance Manager',
        true,
        false,
        '550e8400-e29b-41d4-a716-446655440000',
        4
    ) ON CONFLICT (id) DO NOTHING;

-- Create default demo logistics manager user (password: logistics123)
INSERT INTO
    users (
        id,
        email,
        password_hash,
        first_name,
        last_name,
        is_active,
        is_superuser,
        tenant_id,
        role_id
    )
VALUES (
        'b5dc781f-9e43-4863-9e35-8772b26a7b77',
        'logistics.manager@example.com',
        'c1dedde8092024d84b5e24e0e18f0202cf493c98e45916ac53a751d7e516a1fd',
        'Demo',
        'Logistics Manager',
        true,
        false,
        '550e8400-e29b-41d4-a716-446655440000',
        5
    ) ON CONFLICT (id) DO NOTHING;

-- Create default demo driver user (password: driver123)
INSERT INTO
    users (
        id,
        email,
        password_hash,
        first_name,
        last_name,
        is_active,
        is_superuser,
        tenant_id,
        role_id
    )
VALUES (
        'c5dc781f-9e43-4863-9e35-8772b26a7b77',
        'driver@example.com',
        'd1ede8092024d84b5e24e0e18f0202cf493c98e45916ac53a751d7e516a1fe',
        'Demo',
        'Driver',
        true,
        false,
        '550e8400-e29b-41d4-a716-446655440000',
        6
    ) ON CONFLICT (id) DO NOTHING;

-- Create default demo user (password: user123)
INSERT INTO
    users (
        id,
        email,
        password_hash,
        first_name,
        last_name,
        is_active,
        is_superuser,
        tenant_id,
        role_id
    )
VALUES (
        'd5dc781f-9e43-4863-9e35-8772b26a7b77',
        'user@example.com',
        '38a907ef3c2aa3ed2ba2865279723ad3398dfc0a2bd5fc22cc6c167a3dba5fe7',
        'Demo',
        'User',
        true,
        false,
        '550e8400-e29b-41d4-a716-446655440000',
        7
    ) ON CONFLICT (id) DO NOTHING;

-- Note: Super admin (id: a5dc781f-9e43-4863-9e35-8772b26a7b77) is NOT assigned to any tenant
-- Super admins can manage all tenants without being assigned to one

-- Add foreign key constraint for admin_id after both tables exist
-- This handles the circular reference between tenants and users
DO $$
BEGIN
    -- Check if the foreign key constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_tenants_admin_id'
        AND table_name = 'tenants'
    ) THEN
        -- Add the foreign key constraint
        ALTER TABLE tenants
        ADD CONSTRAINT fk_tenants_admin_id
        FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;