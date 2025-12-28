-- Migration: Increase driver_profiles.license_type column length and remove value constraint
-- Description: Increases license_type from VARCHAR(20) to VARCHAR(50)
--              Removes CHECK constraint to allow any license type value
--              This allows values like "Light Motor Vehicle (LMV)", "Heavy Motor Vehicle (HMV)", etc.

-- Drop the CHECK constraint that restricts values to 'light_motor', 'heavy_motor', 'transport', 'goods'
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'driver_profiles_license_type_check'
    ) THEN
        ALTER TABLE driver_profiles DROP CONSTRAINT driver_profiles_license_type_check;
    END IF;
END $$;

-- Alter the license_type column to VARCHAR(50)
ALTER TABLE driver_profiles
ALTER COLUMN license_type TYPE VARCHAR(50) USING license_type::VARCHAR(50);

-- Add comment
COMMENT ON COLUMN driver_profiles.license_type IS 'License type (e.g., Light Motor Vehicle (LMV), Heavy Motor Vehicle (HMV), Transport Vehicle, Goods Vehicle)';
