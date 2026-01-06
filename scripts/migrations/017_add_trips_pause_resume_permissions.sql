-- Migration 017: Add trips pause and resume permissions
-- Description: Adds permissions for drivers to pause and resume trips

-- Add new permissions for pausing and resuming trips
INSERT INTO permissions (resource, action, description)
VALUES
    ('trips', 'pause', 'Pause a trip due to maintenance or issues'),
    ('trips', 'resume', 'Resume a paused trip')
ON CONFLICT (resource, action) DO NOTHING;

-- Assign pause and resume permissions to Driver role (role_id = 6)
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT 6, p.id, NOW()
FROM permissions p
WHERE p.resource = 'trips'
  AND p.action IN ('pause', 'resume')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Also assign pause and resume permissions to Logistics Manager (role_id = 5)
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT 5, p.id, NOW()
FROM permissions p
WHERE p.resource = 'trips'
  AND p.action IN ('pause', 'resume')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Also assign pause and resume permissions to Branch Manager (role_id = 3)
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT 3, p.id, NOW()
FROM permissions p
WHERE p.resource = 'trips'
  AND p.action IN ('pause', 'resume')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Also assign pause and resume permissions to Admin (role_id = 2)
INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT 2, p.id, NOW()
FROM permissions p
WHERE p.resource = 'trips'
  AND p.action IN ('pause', 'resume')
ON CONFLICT (role_id, permission_id) DO NOTHING;

COMMIT;
