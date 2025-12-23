-- Update trip_orders priority constraint to include 'normal' value
-- This fixes the issue where Priority.NORMAL enum value is not accepted

-- First, drop the old constraint
ALTER TABLE trip_orders DROP CONSTRAINT IF EXISTS check_priority;

-- Then, add the new constraint with 'normal' included
ALTER TABLE trip_orders
ADD CONSTRAINT check_priority
CHECK (priority IN ('high', 'medium', 'low', 'normal'));

-- Verify the constraint
SELECT conname AS constraint_name, pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'trip_orders'::regclass
  AND conname = 'check_priority';