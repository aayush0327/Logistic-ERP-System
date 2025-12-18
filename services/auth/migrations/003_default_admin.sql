-- Create default tenant, role, and admin user
-- This migration sets up the initial system administrator

-- Create default tenant
INSERT INTO tenants (id, name, domain, is_active) VALUES
('tenant_default', 'Default Organization', NULL, TRUE) ON CONFLICT (id) DO NOTHING;

-- Create default admin role with all permissions
INSERT INTO roles (id, name, description, tenant_id, is_system) VALUES
('role_admin', 'Administrator', 'System administrator with full access', 'tenant_default', TRUE) ON CONFLICT (id) DO NOTHING;

-- Create default manager role
INSERT INTO roles (id, name, description, tenant_id, is_system) VALUES
('role_manager', 'Manager', 'Manager with business-level access', 'tenant_default', TRUE) ON CONFLICT (id) DO NOTHING;

-- Create default employee role
INSERT INTO roles (id, name, description, tenant_id, is_system) VALUES
('role_employee', 'Employee', 'Standard employee with basic access', 'tenant_default', TRUE) ON CONFLICT (id) DO NOTHING;

-- Assign all permissions to admin role
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT
    'rp_' || role_id || '_' || permission_id,
    'role_admin' as role_id,
    id as permission_id
FROM permissions
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign manager permissions
INSERT INTO role_permissions (id, role_id, permission_id) VALUES
('rp_role_manager_perm_002', 'role_manager', 'perm_002'),
('rp_role_manager_perm_003', 'role_manager', 'perm_003'),
('rp_role_manager_perm_006', 'role_manager', 'perm_006'),
('rp_role_manager_perm_010', 'role_manager', 'perm_010'),
('rp_role_manager_perm_014', 'role_manager', 'perm_014'),
('rp_role_manager_perm_020', 'role_manager', 'perm_020'),
('rp_role_manager_perm_023', 'role_manager', 'perm_023'),
('rp_role_manager_perm_025', 'role_manager', 'perm_025'),
('rp_role_manager_perm_026', 'role_manager', 'perm_026'),
('rp_role_manager_perm_029', 'role_manager', 'perm_029'),
('rp_role_manager_perm_030', 'role_manager', 'perm_030'),
('rp_role_manager_perm_034', 'role_manager', 'perm_034'),
('rp_role_manager_perm_035', 'role_manager', 'perm_035'),
('rp_role_manager_perm_039', 'role_manager', 'perm_039'),
('rp_role_manager_perm_040', 'role_manager', 'perm_040'),
('rp_role_manager_perm_041', 'role_manager', 'perm_041'),
('rp_role_manager_perm_044', 'role_manager', 'perm_044'),
('rp_role_manager_perm_045', 'role_manager', 'perm_045'),
('rp_role_manager_perm_046', 'role_manager', 'perm_046'),
('rp_role_manager_perm_049', 'role_manager', 'perm_049'),
('rp_role_manager_perm_050', 'role_manager', 'perm_050'),
('rp_role_manager_perm_051', 'role_manager', 'perm_051'),
('rp_role_manager_perm_053', 'role_manager', 'perm_053'),
('rp_role_manager_perm_055', 'role_manager', 'perm_055'),
('rp_role_manager_perm_056', 'role_manager', 'perm_056'),
('rp_role_manager_perm_062', 'role_manager', 'perm_062')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign employee permissions
INSERT INTO role_permissions (id, role_id, permission_id) VALUES
('rp_role_employee_perm_003', 'role_employee', 'perm_003'),
('rp_role_employee_perm_006', 'role_employee', 'perm_006'),
('rp_role_employee_perm_023', 'role_employee', 'perm_023'),
('rp_role_employee_perm_026', 'role_employee', 'perm_026'),
('rp_role_employee_perm_034', 'role_employee', 'perm_034'),
('rp_role_employee_perm_039', 'role_employee', 'perm_039'),
('rp_role_employee_perm_041', 'role_employee', 'perm_041'),
('rp_role_employee_perm_044', 'role_employee', 'perm_044'),
('rp_role_employee_perm_046', 'role_employee', 'perm_046'),
('rp_role_employee_perm_049', 'role_employee', 'perm_049'),
('rp_role_employee_perm_051', 'role_employee', 'perm_051'),
('rp_role_employee_perm_053', 'role_employee', 'perm_053'),
('rp_role_employee_perm_062', 'role_employee', 'perm_062')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Create default admin user (password: admin123)
-- NOTE: This is a default password that should be changed immediately after first login
INSERT INTO users (id, email, password_hash, first_name, last_name, is_active, is_superuser, tenant_id, role_id) VALUES
('user_admin', 'admin@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/ukR.FLi9G', 'System', 'Administrator', TRUE, TRUE, 'tenant_default', 'role_admin')
ON CONFLICT (id) DO NOTHING;

-- Create default demo manager user (password: manager123)
INSERT INTO users (id, email, password_hash, first_name, last_name, is_active, is_superuser, tenant_id, role_id) VALUES
('user_manager', 'manager@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/ukR.FLi9G', 'Demo', 'Manager', TRUE, FALSE, 'tenant_default', 'role_manager')
ON CONFLICT (id) DO NOTHING;

-- Create default demo employee user (password: employee123)
INSERT INTO users (id, email, password_hash, first_name, last_name, is_active, is_superuser, tenant_id, role_id) VALUES
('user_employee', 'employee@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/ukR.FLi9G', 'Demo', 'Employee', TRUE, FALSE, 'tenant_default', 'role_employee')
ON CONFLICT (id) DO NOTHING;