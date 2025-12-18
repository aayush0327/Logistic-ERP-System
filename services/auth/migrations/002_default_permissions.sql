-- Default permissions for the system
-- This migration inserts basic permissions needed for the application

INSERT INTO permissions (id, resource, action, description) VALUES
-- User management permissions
('perm_001', 'users', 'create', 'Create new users'),
('perm_002', 'users', 'read', 'View user information'),
('perm_003', 'users', 'read_own', 'View own user information'),
('perm_004', 'users', 'read_all', 'View all users information'),
('perm_005', 'users', 'update', 'Update user information'),
('perm_006', 'users', 'update_own', 'Update own user information'),
('perm_007', 'users', 'delete', 'Delete users'),
('perm_008', 'users', 'manage_all', 'Full user management'),

-- Role management permissions
('perm_009', 'roles', 'create', 'Create new roles'),
('perm_010', 'roles', 'read', 'View role information'),
('perm_011', 'roles', 'update', 'Update role information'),
('perm_012', 'roles', 'delete', 'Delete roles'),
('perm_013', 'roles', 'assign', 'Assign roles to users'),

-- Permission management permissions
('perm_014', 'permissions', 'read', 'View permission information'),
('perm_015', 'permissions', 'assign', 'Assign permissions to roles'),

-- Tenant management permissions
('perm_016', 'tenants', 'create', 'Create new tenants'),
('perm_017', 'tenants', 'read', 'View tenant information'),
('perm_018', 'tenants', 'update', 'Update tenant information'),
('perm_019', 'tenants', 'delete', 'Delete tenants'),
('perm_020', 'tenants', 'manage_own', 'Manage own tenant'),
('perm_021', 'tenants', 'manage_all', 'Manage all tenants'),

-- Order management permissions
('perm_022', 'orders', 'create', 'Create new orders'),
('perm_023', 'orders', 'read', 'View order information'),
('perm_024', 'orders', 'read_own', 'View own orders'),
('perm_025', 'orders', 'read_all', 'View all orders'),
('perm_026', 'orders', 'update', 'Update order information'),
('perm_027', 'orders', 'update_own', 'Update own orders'),
('perm_028', 'orders', 'delete', 'Delete orders'),
('perm_029', 'orders', 'cancel', 'Cancel orders'),
('perm_030', 'orders', 'approve', 'Approve orders'),
('perm_031', 'orders', 'reject', 'Reject orders'),

-- Inventory management permissions
('perm_032', 'inventory', 'create', 'Create inventory items'),
('perm_033', 'inventory', 'read', 'View inventory information'),
('perm_034', 'inventory', 'read_all', 'View all inventory'),
('perm_035', 'inventory', 'update', 'Update inventory information'),
('perm_036', 'inventory', 'delete', 'Delete inventory items'),
('perm_037', 'inventory', 'adjust', 'Adjust inventory levels'),

-- Customer management permissions
('perm_038', 'customers', 'create', 'Create new customers'),
('perm_039', 'customers', 'read', 'View customer information'),
('perm_040', 'customers', 'read_all', 'View all customers'),
('perm_041', 'customers', 'update', 'Update customer information'),
('perm_042', 'customers', 'delete', 'Delete customers'),

-- Supplier management permissions
('perm_043', 'suppliers', 'create', 'Create new suppliers'),
('perm_044', 'suppliers', 'read', 'View supplier information'),
('perm_045', 'suppliers', 'read_all', 'View all suppliers'),
('perm_046', 'suppliers', 'update', 'Update supplier information'),
('perm_047', 'suppliers', 'delete', 'Delete suppliers'),

-- Shipping management permissions
('perm_048', 'shipping', 'create', 'Create shipping records'),
('perm_049', 'shipping', 'read', 'View shipping information'),
('perm_050', 'shipping', 'read_all', 'View all shipping records'),
('perm_051', 'shipping', 'update', 'Update shipping information'),
('perm_052', 'shipping', 'delete', 'Delete shipping records'),

-- Reporting permissions
('perm_053', 'reports', 'read', 'View reports'),
('perm_054', 'reports', 'read_all', 'View all reports'),
('perm_055', 'reports', 'create', 'Create reports'),
('perm_056', 'reports', 'export', 'Export reports'),

-- System permissions
('perm_057', 'system', 'read', 'View system information'),
('perm_058', 'system', 'admin', 'System administration'),
('perm_059', 'system', 'logs', 'View system logs'),
('perm_060', 'system', 'backup', 'Create system backups'),
('perm_061', 'system', 'restore', 'Restore system backups'),

-- Dashboard permissions
('perm_062', 'dashboard', 'read', 'View dashboard'),
('perm_063', 'dashboard', 'read_own', 'View own dashboard'),
('perm_064', 'dashboard', 'read_all', 'View all dashboards'),

-- Superuser permission
('perm_999', 'superuser', 'access', 'Full system access') ON CONFLICT DO NOTHING;