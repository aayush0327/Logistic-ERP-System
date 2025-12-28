-- Migration: Modify role_id column in employee_profiles
-- Description: Makes role_id nullable and changes it to store auth service role ID as string
--              Removes foreign key constraint to company_roles since roles are now managed by auth service

-- Drop the foreign key constraint (if exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'employee_profiles'
        AND constraint_name = 'employee_profiles_role_id_fkey'
    ) THEN
        ALTER TABLE employee_profiles DROP CONSTRAINT employee_profiles_role_id_fkey;
    END IF;
END $$;

-- Change role_id to VARCHAR(50) and make it nullable
ALTER TABLE employee_profiles
ALTER COLUMN role_id TYPE VARCHAR(50) USING role_id::VARCHAR(50);

ALTER TABLE employee_profiles
ALTER COLUMN role_id DROP NOT NULL;

-- Add comment
COMMENT ON COLUMN employee_profiles.role_id IS 'Auth service role ID (stored as string) - references roles.id table in auth service';
