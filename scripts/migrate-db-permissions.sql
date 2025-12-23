-- Database migration script for permission system
-- This script creates the necessary tables and indexes for the new permission system

-- Create permissions table if it doesn't exist
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(resource, action)
);

-- Create role_permissions junction table if it doesn't exist
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id INTEGER NOT NULL,
    permission_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
    UNIQUE(role_id, permission_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource);
CREATE INDEX IF NOT EXISTS idx_permissions_action ON permissions(action);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);

-- Create materialized view for active user permissions
CREATE MATERIALIZED VIEW IF NOT EXISTS active_user_permissions AS
SELECT
    u.id as user_id,
    u.tenant_id,
    ur.role_id,
    p.resource,
    p.action,
    CONCAT(p.resource, ':', p.action) as permission_name,
    u.updated_at as last_updated
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN role_permissions rp ON ur.role_id = rp.role_id
JOIN permissions p ON rp.permission_id = p.id
WHERE u.is_active = true;

-- Create unique index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_user_permissions_unique
ON active_user_permissions(user_id, role_id, permission_name);

-- Create index for faster permission lookups
CREATE INDEX IF NOT EXISTS idx_active_user_permissions_user_id ON active_user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_active_user_permissions_permission ON active_user_permissions(permission_name);

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_user_permissions()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY active_user_permissions;
END;
$$ LANGUAGE plpgsql;

-- Insert comprehensive permissions if they don't exist
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
    ('users', 'read_permissions', 'Read user permissions'),

    -- Role management permissions
    ('roles', 'create', 'Create new roles'),
    ('roles', 'read', 'View role information'),
    ('roles', 'read_all', 'Read all role data'),
    ('roles', 'update', 'Update role information'),
    ('roles', 'delete', 'Delete roles'),
    ('roles', 'assign', 'Assign roles to users'),
    ('roles', 'manage_all', 'Manage all roles'),

    -- Permission management permissions
    ('permissions', 'read', 'View permission information'),
    ('permissions', 'assign', 'Assign permissions to roles'),

    -- Tenant management permissions
    ('tenants', 'create', 'Create new tenants'),
    ('tenants', 'read', 'View tenant information'),
    ('tenants', 'read_all', 'Read all tenant data'),
    ('tenants', 'update', 'Update tenant information'),
    ('tenants', 'delete', 'Delete tenants'),
    ('tenants', 'manage_own', 'Manage own tenant'),
    ('tenants', 'manage_all', 'Manage all tenants'),

    -- Company/Branch management permissions
    ('branches', 'create', 'Create new branches'),
    ('branches', 'read', 'View branch information'),
    ('branches', 'read_all', 'View all branches'),
    ('branches', 'read_own', 'View own assigned branches'),
    ('branches', 'update', 'Update branch information'),
    ('branches', 'update_own', 'Update own assigned branches'),
    ('branches', 'delete', 'Delete branches'),
    ('branches', 'manage_own', 'Manage own assigned branches'),
    ('branches', 'manage_all', 'Manage all branches'),
    ('branches', 'view_metrics', 'View branch metrics'),

    -- Order management permissions
    ('orders', 'create', 'Create new orders'),
    ('orders', 'read', 'View order information'),
    ('orders', 'read_own', 'View own orders'),
    ('orders', 'read_all', 'View all orders'),
    ('orders', 'update', 'Update order information'),
    ('orders', 'update_own', 'Update own orders'),
    ('orders', 'delete', 'Delete orders'),
    ('orders', 'delete_own', 'Delete own orders'),
    ('orders', 'cancel', 'Cancel orders'),
    ('orders', 'status_update', 'Update order status'),
    ('orders', 'priority_update', 'Update order priority'),
    ('orders', 'approve_finance', 'Approve orders in finance'),
    ('orders', 'approve_logistics', 'Approve orders in logistics'),
    ('orders', 'approve_any', 'Approve orders in any department'),
    ('orders', 'bulk_approve', 'Bulk approve orders'),
    ('orders', 'financial_view', 'View financial information'),
    ('orders', 'financial_edit', 'Edit financial information'),
    ('orders', 'payment_process', 'Process payments'),
    ('orders', 'refund_process', 'Process refunds'),
    ('orders', 'invoice_create', 'Create invoices'),
    ('orders', 'logistics_view', 'View logistics information'),
    ('orders', 'logistics_edit', 'Edit logistics information'),
    ('orders', 'shipment_create', 'Create shipments'),
    ('orders', 'tracking_update', 'Update tracking information'),
    ('orders', 'delivery_confirm', 'Confirm deliveries'),
    ('orders', 'export', 'Export orders'),
    ('orders', 'import', 'Import orders'),
    ('orders', 'bulk_create', 'Bulk create orders'),
    ('orders', 'bulk_update', 'Bulk update orders'),
    ('orders', 'bulk_cancel', 'Bulk cancel orders'),
    ('orders', 'bulk_delete', 'Bulk delete orders'),
    ('orders', 'split', 'Split orders'),
    ('orders', 'reassign', 'Reassign orders'),
    ('orders', 'assign', 'Assign orders'),

    -- Order document permissions
    ('order_documents', 'upload', 'Upload order documents'),
    ('order_documents', 'read', 'View order documents'),
    ('order_documents', 'read_own', 'View own order documents'),
    ('order_documents', 'read_all', 'View all order documents'),
    ('order_documents', 'update', 'Update order documents'),
    ('order_documents', 'update_own', 'Update own order documents'),
    ('order_documents', 'delete', 'Delete order documents'),
    ('order_documents', 'delete_own', 'Delete own order documents'),
    ('order_documents', 'verify', 'Verify order documents'),
    ('order_documents', 'download', 'Download order documents'),
    ('order_documents', 'create', 'Create order documents'),

    -- Inventory management permissions (WMS)
    ('wms', 'create', 'Create inventory items'),
    ('wms', 'read', 'View inventory information'),
    ('wms', 'read_all', 'View all inventory'),
    ('wms', 'update', 'Update inventory information'),
    ('wms', 'delete', 'Delete inventory items'),
    ('wms', 'adjust', 'Adjust inventory levels'),

    -- Transportation management permissions (TMS)
    ('trips', 'create', 'Create new trips'),
    ('trips', 'read', 'Read own trips'),
    ('trips', 'read_all', 'Read all trips across branches'),
    ('trips', 'update', 'Update existing trips'),
    ('trips', 'delete', 'Delete trips'),
    ('trips', 'assign', 'Assign orders to trips'),
    ('trips', 'track', 'Track trip status'),

    -- Resource permissions
    ('resources', 'read', 'Read own resources (trucks, drivers)'),
    ('resources', 'read_all', 'Read all resources across branches'),

    -- Driver permissions
    ('drivers', 'assign', 'Assign drivers to trips'),
    ('drivers', 'create', 'Create new drivers'),
    ('drivers', 'read', 'Read driver information'),
    ('drivers', 'read_all', 'Read all driver data'),
    ('drivers', 'update', 'Update driver information'),
    ('drivers', 'delete', 'Delete drivers'),

    -- Vehicle permissions
    ('vehicles', 'track', 'Track vehicle location'),
    ('vehicles', 'create', 'Create new vehicles'),
    ('vehicles', 'read', 'Read vehicle information'),
    ('vehicles', 'read_all', 'Read all vehicle data'),
    ('vehicles', 'read_own', 'Read own vehicle information'),
    ('vehicles', 'update', 'Update vehicle information'),
    ('vehicles', 'update_own', 'Update own vehicle information'),
    ('vehicles', 'delete', 'Delete vehicles'),
    ('vehicles', 'delete_own', 'Delete own vehicles'),
    ('vehicles', 'assign', 'Assign vehicles to drivers/routes'),
    ('vehicles', 'maintenance', 'Manage vehicle maintenance'),
    ('vehicles', 'update_mileage', 'Update vehicle mileage'),

    -- Route permissions
    ('routes', 'create', 'Create new routes'),
    ('routes', 'optimize', 'Optimize routes'),
    ('routes', 'update', 'Update existing routes'),

    -- Schedule permissions
    ('schedules', 'read', 'Read schedule information'),
    ('schedules', 'update', 'Update schedules'),

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
    ('customers', 'read_own', 'View own assigned customers'),
    ('customers', 'update', 'Update customer information'),
    ('customers', 'update_own', 'Update own assigned customers'),
    ('customers', 'delete', 'Delete customers'),
    ('customers', 'export', 'Export customer data'),

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

    -- Product management permissions
    ('products', 'create', 'Create new products'),
    ('products', 'read', 'View product information'),
    ('products', 'read_all', 'View all products'),
    ('products', 'update', 'Update product information'),
    ('products', 'delete', 'Delete products'),
    ('products', 'stock_adjust', 'Adjust product stock levels'),
    ('products', 'pricing_update', 'Update product pricing'),
    ('products', 'bulk_update', 'Bulk update products'),
    ('products', 'low_stock_view', 'View low stock alerts'),
    ('products', 'stock_history', 'View stock history'),
    ('products', 'manage_all', 'Manage all products'),

    -- Product category permissions
    ('product_categories', 'create', 'Create product categories'),
    ('product_categories', 'read', 'View product categories'),
    ('product_categories', 'read_all', 'View all product categories'),
    ('product_categories', 'update', 'Update product categories'),
    ('product_categories', 'delete', 'Delete product categories'),
    ('product_categories', 'reorganize', 'Reorganize product categories'),

    -- Company reports permissions
    ('company_reports', 'read', 'View company reports'),
    ('company_reports', 'read_own', 'View own company reports'),
    ('company_reports', 'read_all', 'View all company reports'),
    ('company_reports', 'export', 'Export company reports'),
    ('company_reports', 'financial', 'Access financial reports'),
    ('company_reports', 'operational', 'Access operational reports'),

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

    -- Company management permissions
    ('company', 'settings_view', 'View company settings'),
    ('company', 'settings_update', 'Update company settings'),
    ('company', 'integrations_manage', 'Manage company integrations'),

    -- Analytics permissions
    ('analytics', 'read', 'View analytics'),
    ('analytics', 'financial', 'View financial analytics'),
    ('analytics', 'operational', 'View operational analytics'),

    -- Superuser permissions
    ('superuser', 'access', 'Full system access'),
    ('admin', 'access', 'Admin access')
ON CONFLICT (resource, action) DO NOTHING;

-- Create wildcard permissions for full access to major resources
INSERT INTO permissions (id, resource, action, description, created_at, updated_at)
VALUES
    ('tenant-admin-orders-all', 'orders', '*', 'Tenant admin has full access to all order operations', NOW(), NOW()),
    ('tenant-admin-products-all', 'products', '*', 'Tenant admin has full access to all product operations', NOW(), NOW()),
    ('tenant-admin-vehicles-all', 'vehicles', '*', 'Tenant admin has full access to all vehicle operations', NOW(), NOW()),
    ('tenant-admin-customers-all', 'customers', '*', 'Tenant admin has full access to all customer operations', NOW(), NOW()),
    ('tenant-admin-branches-all', 'branches', '*', 'Tenant admin has full access to all branch operations', NOW(), NOW())
ON CONFLICT (id) DO UPDATE
SET updated_at = NOW();

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON permissions TO authenticated_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON role_permissions TO authenticated_user;
GRANT SELECT ON active_user_permissions TO authenticated_user;
GRANT EXECUTE ON FUNCTION refresh_user_permissions() TO authenticated_user;

-- Create refresh schedule (optional - requires pg_cron extension)
-- SELECT cron.schedule('refresh-user-permissions', '*/15 * * * *', 'SELECT refresh_user_permissions();');

-- Instructions for manual refresh:
-- To refresh materialized view manually, run:
-- SELECT refresh_user_permissions();

-- Verify the migration:
-- 1. Check permissions table: SELECT COUNT(*) FROM permissions;
-- 2. Check role_permissions table: SELECT COUNT(*) FROM role_permissions;
-- 3. Check materialized view: SELECT COUNT(*) FROM active_user_permissions;
-- 4. Test permission lookup for a user: SELECT * FROM active_user_permissions WHERE user_id = 'user-uuid';