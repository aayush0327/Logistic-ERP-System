-- Add products:read permission to role_id 9
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT 9, p.id, NOW()
FROM permissions p
WHERE p.resource = 'products' AND p.action = 'read'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = 9 AND rp.permission_id = p.id
  );

-- Add products:read_all permission to role_id 9
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT 9, p.id, NOW()
FROM permissions p
WHERE p.resource = 'products' AND p.action = 'read_all'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = 9 AND rp.permission_id = p.id
  );

-- Add branches permissions to both Finance Manager roles (4 and 10)
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT role_id, p.id, NOW()
FROM (VALUES (4::INTEGER), (10::INTEGER)) AS roles(role_id)
CROSS JOIN permissions p
WHERE p.resource = 'branches' 
  AND p.action IN ('read', 'read_all')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = roles.role_id AND rp.permission_id = p.id
  );

-- Add trips:update and trips:pause permissions to both Driver roles
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT role_id, p.id, NOW()
FROM (VALUES (6::INTEGER), (12::INTEGER)) AS roles(role_id)
CROSS JOIN permissions p
WHERE p.resource = 'trips' 
  AND p.action IN ('update', 'pause')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = roles.role_id AND rp.permission_id = p.id
  );


-- Fix Driver role (role_id 12) - Add missing permissions for delivery operations
-- This fixes the tenant: e3347216-95dd-4455-bab2-89b8273d30f5

-- Add missing permissions to Driver role (role_id 12)
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT 
    12 as role_id,
    p.id as permission_id,
    NOW() as created_at
FROM permissions p
WHERE p.resource || ':' || p.action IN (
    'orders:update',           -- Required to update order items status
    'tms:status_update',       -- Required to update driver/vehicle status on trip completion
    'users:update_own',        -- Required for driver to update own status
    'vehicles:update',         -- Required for vehicle status updates
    'drivers:update',          -- Required for driver operations
    'drivers:read'             -- Required for driver read operations
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Verify the fix - check all Driver role permissions
SELECT 
    r.id as role_id,
    r.tenant_id,
    r.name as role_name,
    p.resource || ':' || p.action as permission
FROM roles r
JOIN role_permissions rp ON r.id = rp.role_id
JOIN permissions p ON rp.permission_id = p.id
WHERE r.name = 'Driver'
ORDER BY r.tenant_id, p.resource, p.action;
