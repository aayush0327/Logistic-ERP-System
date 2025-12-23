-- Add Finance Service Permissions
-- These permissions are required by the Finance Service for finance approval workflow

-- 1. Insert new Finance permissions
INSERT INTO permissions (resource, action, description, created_at)
VALUES
    ('finance', 'read', 'View finance information and pending approvals', NOW()),
    ('finance', 'approve', 'Approve or reject orders in finance', NOW()),
    ('finance', 'approve_bulk', 'Bulk approve or reject orders in finance', NOW()),
    ('finance', 'reports', 'View finance reports and dashboard', NOW()),
    ('finance', 'export', 'Export finance data', NOW())
ON CONFLICT (resource, action) DO NOTHING;

-- 2. Assign Finance permissions to Admin role (role_id = 2)
-- This gives admins full access to Finance features
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT 2, p.id, NOW()
FROM permissions p
WHERE p.resource = 'finance'
  AND p.action IN ('read', 'approve', 'approve_bulk', 'reports', 'export')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 3. Assign Finance permissions to Finance Manager role (role_id = 4)
-- This gives finance managers access to Finance features
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT 4, p.id, NOW()
FROM permissions p
WHERE p.resource = 'finance'
  AND p.action IN ('read', 'approve', 'approve_bulk', 'reports', 'export')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4. Also assign basic read permission to Branch Manager (role_id = 3)
-- Branch managers can view finance info but not approve
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT 3, p.id, NOW()
FROM permissions p
WHERE p.resource = 'finance'
  AND p.action IN ('read', 'reports')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 5. Grant finance:read to regular User role (role_id = 7)
-- Users can view their own finance-related info
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT 7, p.id, NOW()
FROM permissions p
WHERE p.resource = 'finance'
  AND p.action = 'read'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Verification query to check permissions
SELECT
    r.name as role_name,
    p.resource,
    p.action,
    p.description
FROM role_permissions rp
JOIN roles r ON rp.role_id = r.id
JOIN permissions p ON rp.permission_id = p.id
WHERE p.resource = 'finance'
ORDER BY r.id, p.action;