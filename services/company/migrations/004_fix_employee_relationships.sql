-- Fix Employee Profile Relationships
-- This migration adds the missing foreign key constraint for the reports_to field

-- Add foreign key constraint to reports_to field if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'employee_profiles_reports_to_fkey'
        AND table_name = 'employee_profiles'
    ) THEN
        ALTER TABLE employee_profiles
        ADD CONSTRAINT employee_profiles_reports_to_fkey
        FOREIGN KEY (reports_to) REFERENCES employee_profiles(id);
    END IF;
END
$$;