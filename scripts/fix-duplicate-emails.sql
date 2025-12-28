-- Script to fix duplicate emails in the auth service database
-- This script will:
-- 1. Find all duplicate emails
-- 2. Keep the first user created for each email
-- 3. Deactivate or remove duplicates

-- First, let's see all duplicates
SELECT
    email,
    COUNT(*) as duplicate_count,
    STRING_AGG(id, ', ') as user_ids,
    STRING_AGG(tenant_id, ', ') as tenant_ids
FROM users
WHERE email IS NOT NULL
GROUP BY email
HAVING COUNT(*) > 1;

-- Create a temporary table to identify duplicates
CREATE TEMPORARY TABLE duplicates_to_keep AS
SELECT
    MIN(id) as id_to_keep,
    email
FROM users
WHERE email IS NOT NULL
GROUP BY email;

-- Deactivate all duplicate users except the first one created
UPDATE users
SET is_active = false,
    updated_at = CURRENT_TIMESTAMP
WHERE id NOT IN (SELECT id_to_keep FROM duplicates_to_keep)
AND email IN (SELECT email FROM duplicates_to_keep);

-- Show the results
SELECT
    u.email,
    u.is_active,
    u.tenant_id,
    u.first_name,
    u.last_name,
    u.created_at
FROM users u
WHERE u.email IN (SELECT email FROM duplicates_to_keep)
ORDER BY u.email, u.created_at;