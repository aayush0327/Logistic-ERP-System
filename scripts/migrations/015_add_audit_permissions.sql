-- Migration 015: Add audit:read and audit:export permissions to Admin role
-- This ensures existing Admin users can access the audit logs

-- Add audit:read permission to Admin role (role_id = 2)
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT 2, p.id, NOW()
FROM permissions p
WHERE p.resource = 'audit' AND p.action = 'read'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = 2 AND rp.permission_id = p.id
  );

-- Add audit:export permission to Admin role (role_id = 2)
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT 2, p.id, NOW()
FROM permissions p
WHERE p.resource = 'audit' AND p.action = 'export'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = 2 AND rp.permission_id = p.id
  );

-- Also add to any other Admin-like roles for other tenants (role_id > 2 that are system admin roles)
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, NOW()
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Admin' AND r.is_system = true
  AND p.resource = 'audit' AND p.action IN ('read', 'export')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

COMMIT;
