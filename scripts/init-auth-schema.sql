-- Auth Service Database Schema Initialization
-- This file will be executed after the database is created

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable Row Level Security
ALTER DATABASE postgres SET row_security = on;

-- Create tenants table (without admin_id constraint initially to avoid circular reference)
CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(255) PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE,
    settings TEXT,
    is_active BOOLEAN DEFAULT true,
    admin_id VARCHAR(255) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,  -- Changed to auto-increment integer
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT false,
    tenant_id VARCHAR(255) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id VARCHAR(255) PRIMARY KEY DEFAULT uuid_generate_v4(),
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create role_permissions association table
CREATE TABLE IF NOT EXISTS role_permissions (
    id VARCHAR(255) PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id VARCHAR(255) NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role_id, permission_id)
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    is_superuser BOOLEAN DEFAULT false,
    last_login TIMESTAMP WITH TIME ZONE,
    login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    tenant_id VARCHAR(255) REFERENCES tenants(id),  -- Nullable for super admins
    role_id INTEGER NOT NULL REFERENCES roles(id)  -- Changed to INTEGER
);

-- Add unique constraint for email per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_tenant ON users(email, tenant_id);

-- Create refresh_tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id VARCHAR(255) PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_revoked BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP WITH TIME ZONE,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_roles_tenant_id ON roles(tenant_id);

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
INSERT INTO tenants (id, name, domain, is_active)
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'Default Organization', 'demo.logistics-erp.com', true)
ON CONFLICT (id) DO NOTHING;

-- Insert default roles (using integer IDs)
INSERT INTO roles (name, description, tenant_id, is_system) VALUES
    ('Super Admin', 'System administrator with all privileges', '550e8400-e29b-41d4-a716-446655440000', true),
    ('Admin', 'Organization administrator', '550e8400-e29b-41d4-a716-446655440000', true),
    ('Manager', 'Operations manager', '550e8400-e29b-41d4-a716-446655440000', false),
    ('User', 'Regular user', '550e8400-e29b-41d4-a716-446655440000', false)
ON CONFLICT DO NOTHING;

-- Insert default permissions
INSERT INTO permissions (resource, action, description) VALUES
-- User management permissions
    ('users', 'create', 'Create new users'),
    ('users', 'read', 'View user information'),
    ('users', 'read_own', 'View own user information'),
    ('users', 'read_all', 'View all users information'),
    ('users', 'update', 'Update user information'),
    ('users', 'update_own', 'Update own user information'),
    ('users', 'delete', 'Delete users'),
    ('users', 'manage_all', 'Full user management'),

-- Role management permissions
    ('roles', 'create', 'Create new roles'),
    ('roles', 'read', 'View role information'),
    ('roles', 'update', 'Update role information'),
    ('roles', 'delete', 'Delete roles'),
    ('roles', 'assign', 'Assign roles to users'),

-- Permission management permissions
    ('permissions', 'read', 'View permission information'),
    ('permissions', 'assign', 'Assign permissions to roles'),

-- Tenant management permissions
    ('tenants', 'create', 'Create new tenants'),
    ('tenants', 'read', 'View tenant information'),
    ('tenants', 'update', 'Update tenant information'),
    ('tenants', 'delete', 'Delete tenants'),
    ('tenants', 'manage_own', 'Manage own tenant'),
    ('tenants', 'manage_all', 'Manage all tenants'),

-- Order management permissions
    ('orders', 'create', 'Create new orders'),
    ('orders', 'read', 'View order information'),
    ('orders', 'read_own', 'View own orders'),
    ('orders', 'read_all', 'View all orders'),
    ('orders', 'update', 'Update order information'),
    ('orders', 'update_own', 'Update own orders'),
    ('orders', 'delete', 'Delete orders'),
    ('orders', 'cancel', 'Cancel orders'),
    ('orders', 'approve', 'Approve orders'),
    ('orders', 'reject', 'Reject orders'),

-- Inventory management permissions (WMS)
    ('wms', 'create', 'Create inventory items'),
    ('wms', 'read', 'View inventory information'),
    ('wms', 'read_all', 'View all inventory'),
    ('wms', 'update', 'Update inventory information'),
    ('wms', 'delete', 'Delete inventory items'),
    ('wms', 'adjust', 'Adjust inventory levels'),

-- Transportation management permissions (TMS)
    ('tms', 'create', 'Create transportation entries'),
    ('tms', 'read', 'View transportation information'),
    ('tms', 'read_all', 'View all transportation'),
    ('tms', 'update', 'Update transportation information'),
    ('tms', 'delete', 'Delete transportation entries'),

-- Billing permissions
    ('billing', 'create', 'Create billing entries'),
    ('billing', 'read', 'View billing information'),
    ('billing', 'read_all', 'View all billing'),
    ('billing', 'update', 'Update billing information'),
    ('billing', 'delete', 'Delete billing entries'),

-- Customer management permissions
    ('customers', 'create', 'Create new customers'),
    ('customers', 'read', 'View customer information'),
    ('customers', 'read_all', 'View all customers'),
    ('customers', 'update', 'Update customer information'),
    ('customers', 'delete', 'Delete customers'),

-- Supplier management permissions
    ('suppliers', 'create', 'Create new suppliers'),
    ('suppliers', 'read', 'View supplier information'),
    ('suppliers', 'read_all', 'View all suppliers'),
    ('suppliers', 'update', 'Update supplier information'),
    ('suppliers', 'delete', 'Delete suppliers'),

-- Shipping management permissions
    ('shipping', 'create', 'Create shipping records'),
    ('shipping', 'read', 'View shipping information'),
    ('shipping', 'read_all', 'View all shipping records'),
    ('shipping', 'update', 'Update shipping information'),
    ('shipping', 'delete', 'Delete shipping records'),

-- Reporting permissions
    ('reports', 'read', 'View reports'),
    ('reports', 'read_all', 'View all reports'),
    ('reports', 'create', 'Create reports'),
    ('reports', 'export', 'Export reports'),

-- System permissions
    ('system', 'read', 'View system information'),
    ('system', 'admin', 'System administration'),
    ('system', 'logs', 'View system logs'),
    ('system', 'backup', 'Create system backups'),
    ('system', 'restore', 'Restore system backups'),

-- Dashboard permissions
    ('dashboard', 'read', 'View dashboard'),
    ('dashboard', 'read_own', 'View own dashboard'),
    ('dashboard', 'read_all', 'View all dashboards'),

-- Superuser permission
    ('superuser', 'access', 'Full system access')
ON CONFLICT DO NOTHING;

-- Assign all permissions to super admin role (ID = 1)
INSERT INTO role_permissions (role_id, permission_id)
SELECT 1, id FROM permissions
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign manager permissions (ID = 2)
INSERT INTO role_permissions (role_id, permission_id) VALUES
    (2, (SELECT id FROM permissions WHERE resource = 'users' AND action = 'read')),
    (2, (SELECT id FROM permissions WHERE resource = 'users' AND action = 'read_all')),
    (2, (SELECT id FROM permissions WHERE resource = 'users' AND action = 'update')),
    (2, (SELECT id FROM permissions WHERE resource = 'users' AND action = 'create')),
    (2, (SELECT id FROM permissions WHERE resource = 'roles' AND action = 'read')),
    (2, (SELECT id FROM permissions WHERE resource = 'tenants' AND action = 'manage_own')),
    (2, (SELECT id FROM permissions WHERE resource = 'orders' AND action = 'read')),
    (2, (SELECT id FROM permissions WHERE resource = 'orders' AND action = 'read_all')),
    (2, (SELECT id FROM permissions WHERE resource = 'orders' AND action = 'update')),
    (2, (SELECT id FROM permissions WHERE resource = 'orders' AND action = 'create')),
    (2, (SELECT id FROM permissions WHERE resource = 'orders' AND action = 'approve')),
    (2, (SELECT id FROM permissions WHERE resource = 'wms' AND action = 'read')),
    (2, (SELECT id FROM permissions WHERE resource = 'wms' AND action = 'read_all')),
    (2, (SELECT id FROM permissions WHERE resource = 'wms' AND action = 'update')),
    (2, (SELECT id FROM permissions WHERE resource = 'tms' AND action = 'read')),
    (2, (SELECT id FROM permissions WHERE resource = 'tms' AND action = 'read_all')),
    (2, (SELECT id FROM permissions WHERE resource = 'tms' AND action = 'update')),
    (2, (SELECT id FROM permissions WHERE resource = 'billing' AND action = 'read')),
    (2, (SELECT id FROM permissions WHERE resource = 'billing' AND action = 'read_all')),
    (2, (SELECT id FROM permissions WHERE resource = 'billing' AND action = 'update')),
    (2, (SELECT id FROM permissions WHERE resource = 'customers' AND action = 'read')),
    (2, (SELECT id FROM permissions WHERE resource = 'customers' AND action = 'read_all')),
    (2, (SELECT id FROM permissions WHERE resource = 'customers' AND action = 'update')),
    (2, (SELECT id FROM permissions WHERE resource = 'suppliers' AND action = 'read')),
    (2, (SELECT id FROM permissions WHERE resource = 'suppliers' AND action = 'read_all')),
    (2, (SELECT id FROM permissions WHERE resource = 'suppliers' AND action = 'update')),
    (2, (SELECT id FROM permissions WHERE resource = 'shipping' AND action = 'read')),
    (2, (SELECT id FROM permissions WHERE resource = 'shipping' AND action = 'read_all')),
    (2, (SELECT id FROM permissions WHERE resource = 'shipping' AND action = 'update')),
    (2, (SELECT id FROM permissions WHERE resource = 'reports' AND action = 'read')),
    (2, (SELECT id FROM permissions WHERE resource = 'reports' AND action = 'create')),
    (2, (SELECT id FROM permissions WHERE resource = 'reports' AND action = 'export')),
    (2, (SELECT id FROM permissions WHERE resource = 'dashboard' AND action = 'read'))
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign employee permissions (ID = 4)
INSERT INTO role_permissions (role_id, permission_id) VALUES
    (4, (SELECT id FROM permissions WHERE resource = 'users' AND action = 'read_own')),
    (4, (SELECT id FROM permissions WHERE resource = 'users' AND action = 'update_own')),
    (4, (SELECT id FROM permissions WHERE resource = 'orders' AND action = 'read')),
    (4, (SELECT id FROM permissions WHERE resource = 'orders' AND action = 'update')),
    (4, (SELECT id FROM permissions WHERE resource = 'orders' AND action = 'create')),
    (4, (SELECT id FROM permissions WHERE resource = 'wms' AND action = 'read')),
    (4, (SELECT id FROM permissions WHERE resource = 'wms' AND action = 'update')),
    (4, (SELECT id FROM permissions WHERE resource = 'tms' AND action = 'read')),
    (4, (SELECT id FROM permissions WHERE resource = 'tms' AND action = 'update')),
    (4, (SELECT id FROM permissions WHERE resource = 'billing' AND action = 'read')),
    (4, (SELECT id FROM permissions WHERE resource = 'customers' AND action = 'read')),
    (4, (SELECT id FROM permissions WHERE resource = 'customers' AND action = 'update')),
    (4, (SELECT id FROM permissions WHERE resource = 'suppliers' AND action = 'read')),
    (4, (SELECT id FROM permissions WHERE resource = 'suppliers' AND action = 'update')),
    (4, (SELECT id FROM permissions WHERE resource = 'shipping' AND action = 'read')),
    (4, (SELECT id FROM permissions WHERE resource = 'shipping' AND action = 'update')),
    (4, (SELECT id FROM permissions WHERE resource = 'reports' AND action = 'read')),
    (4, (SELECT id FROM permissions WHERE resource = 'dashboard' AND action = 'read'))
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Create default super admin user (password: admin123) - NOT assigned to any tenant
-- NOTE: This is a default password that should be changed immediately after first login
-- Password hash computed with JWT_SECRET: eyJhbGciOiJIUzI1NiJ9.eyJSb2xlIjoiQWRtaW4iLCJJc3N1ZXIiOiJJc3N1ZXIiLCJVc2VybmFtZSI6IkphdmFJblVzZSIsImV4cCI6MTc2NTY5MTkzMywiaWF0IjoxNzY1NjkxOTMzfQ.IR5TvLwqTpsCqR2gRa7ApNoTgfxPAjUh_LQ9JmgoXck
INSERT INTO users (id, email, password_hash, first_name, last_name, is_active, is_superuser, tenant_id, role_id) VALUES
    ('a5dc781f-9e43-4863-9e35-8772b26a7b77', 'admin@example.com', 'aa2573da8923d5d34ffd1fba1e6a2f34af71cb77e039da7e760b0b6242a3ca00', 'System', 'Administrator', true, true, NULL, 1)
ON CONFLICT (id) DO NOTHING;

-- Create default demo manager user (password: manager123)
INSERT INTO users (id, email, password_hash, first_name, last_name, is_active, is_superuser, tenant_id, role_id) VALUES
    ('75267200-9b37-49a5-9ffa-4b7e1f3aba51', 'manager@example.com', '1baedde8092024d84b5e24e0e18f0202cf493c98e45916ac53a751d7e516a1fb', 'Demo', 'Manager', true, false, '550e8400-e29b-41d4-a716-446655440000', 2)
ON CONFLICT (id) DO NOTHING;

-- Create default demo employee user (password: employee123)
INSERT INTO users (id, email, password_hash, first_name, last_name, is_active, is_superuser, tenant_id, role_id) VALUES
    ('5fcd2919-1b77-4c88-b60d-0de84ea3c512', 'employee@example.com', '38a907ef3c2aa3ed2ba2865279723ad3398dfc0a2bd5fc22cc6c167a3dba5fe7', 'Demo', 'Employee', true, false, '550e8400-e29b-41d4-a716-446655440000', 4)
ON CONFLICT (id) DO NOTHING;

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