-- Migration 016: Add paused status and maintenance tracking to trips
-- Description: Adds ability to pause trips for maintenance/accidents

-- Step 1: Drop existing status constraint
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'trips_status_check'
    ) THEN
        ALTER TABLE trips DROP CONSTRAINT trips_status_check;
    END IF;
END $$;

-- Step 2: Add new status constraint with 'paused'
ALTER TABLE trips ADD CONSTRAINT trips_status_check
    CHECK (status IN ('planning', 'loading', 'on-route', 'paused', 'completed', 'cancelled', 'truck-malfunction'));

-- Step 3: Add maintenance tracking columns
ALTER TABLE trips ADD COLUMN IF NOT EXISTS maintenance_note TEXT;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS paused_reason VARCHAR(500);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS resumed_at TIMESTAMP WITH TIME ZONE;

-- Step 4: Add comments for documentation
COMMENT ON COLUMN trips.maintenance_note IS 'Additional notes about maintenance/issues';
COMMENT ON COLUMN trips.paused_at IS 'Timestamp when trip was paused';
COMMENT ON COLUMN trips.paused_reason IS 'Reason for pausing the trip (breakdown, accident, weather, etc.)';
COMMENT ON COLUMN trips.resumed_at IS 'Timestamp when trip was resumed';

COMMIT;
