-- Migration: Add 'assigned' status to vehicle_status enum and driver_profiles check constraint
-- Description: Adds 'assigned' status to track vehicles and drivers that are assigned to trips but not yet on route

-- Add the 'assigned' value to the vehicle_status enum
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum WHERE enumtypid = 'vehicle_status'::regtype AND enumlabel = 'assigned'
    ) THEN
        ALTER TYPE vehicle_status ADD VALUE 'assigned';
    END IF;
END $$;

-- Drop and recreate the driver_profiles current_status check constraint to include 'assigned'
ALTER TABLE driver_profiles DROP CONSTRAINT IF EXISTS driver_profiles_current_status_check;

ALTER TABLE driver_profiles
ADD CONSTRAINT driver_profiles_current_status_check
CHECK (current_status::text = ANY (ARRAY['available'::character varying::text, 'assigned'::character varying::text, 'on_trip'::character varying::text, 'off_duty'::character varying::text, 'on_leave'::character varying::text, 'suspended'::character varying::text]));

-- Verify the changes
SELECT
    'vehicle_status enum values:' as info,
    enumlabel as value
FROM pg_enum
WHERE enumtypid = 'vehicle_status'::regtype
ORDER BY enumsortorder;

SELECT
    'driver_profiles current_status constraint:' as info,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'driver_profiles'::regclass
  AND conname = 'driver_profiles_current_status_check';

-- Note: This migration is idempotent and can be run multiple times safely
