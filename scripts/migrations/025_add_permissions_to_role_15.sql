-- Migration 025: Add company service permissions to role_id 15
-- This adds necessary permissions for role ID 15 to access branches, products, and other company resources

-- Add branches:read permission to role_id 15
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT 15, p.id, NOW()
FROM permissions p
WHERE p.resource = 'branches' AND p.action = 'read'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = 15 AND rp.permission_id = p.id
  );

-- Add branches:read_all permission to role_id 15
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT 15, p.id, NOW()
FROM permissions p
WHERE p.resource = 'branches' AND p.action = 'read_all'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = 15 AND rp.permission_id = p.id
  );

-- Add products:read permission to role_id 15
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT 15, p.id, NOW()
FROM permissions p
WHERE p.resource = 'products' AND p.action = 'read'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = 15 AND rp.permission_id = p.id
  );

-- Add products:read_all permission to role_id 15
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT 15, p.id, NOW()
FROM permissions p
WHERE p.resource = 'products' AND p.action = 'read_all'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = 15 AND rp.permission_id = p.id
  );

-- Add customers:read permission to role_id 15
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT 15, p.id, NOW()
FROM permissions p
WHERE p.resource = 'customers' AND p.action = 'read'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = 15 AND rp.permission_id = p.id
  );

-- Add customers:read_all permission to role_id 15
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT 15, p.id, NOW()
FROM permissions p
WHERE p.resource = 'customers' AND p.action = 'read_all'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = 15 AND rp.permission_id = p.id
  );

-- Add vehicles:read permission to role_id 15
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT 15, p.id, NOW()
FROM permissions p
WHERE p.resource = 'vehicles' AND p.action = 'read'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = 15 AND rp.permission_id = p.id
  );

-- Add vehicles:read_all permission to role_id 15
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT 15, p.id, NOW()
FROM permissions p
WHERE p.resource = 'vehicles' AND p.action = 'read_all'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = 15 AND rp.permission_id = p.id
  );

COMMIT;
