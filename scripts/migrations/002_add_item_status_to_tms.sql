-- Migration: Add Item-Level Status Tracking to TMS Database
-- Database: tms_db
-- This migration adds item_status column to trip_orders table

-- Step 1: Add item_status column to trip_orders table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'trip_orders'
        AND column_name = 'item_status'
    ) THEN
        ALTER TABLE trip_orders ADD COLUMN item_status VARCHAR(50) DEFAULT 'pending_to_assign' CHECK (
            item_status IN ('pending_to_assign', 'planning', 'loading', 'on_route', 'delivered', 'failed', 'returned')
        );

        COMMENT ON COLUMN trip_orders.item_status IS 'Item-level status: pending_to_assign (not assigned), planning (assigned to trip), loading (being loaded), on_route (in transit), delivered (completed), failed (delivery failed), returned (returned to sender)';
    END IF;
END $$;

-- Step 2: Update existing records - set item_status based on current trip status
DO $$
BEGIN
    -- Set item_status to 'planning' for orders assigned to trips in planning status
    UPDATE trip_orders
    SET item_status = 'planning'
    WHERE EXISTS (
        SELECT 1 FROM trips t
        WHERE t.id = trip_orders.trip_id AND t.status = 'planning'
    ) AND trip_orders.item_status = 'pending_to_assign';

    -- Set item_status to 'loading' for orders assigned to trips in loading status
    UPDATE trip_orders
    SET item_status = 'loading'
    WHERE EXISTS (
        SELECT 1 FROM trips t
        WHERE t.id = trip_orders.trip_id AND t.status = 'loading'
    ) AND trip_orders.item_status = 'pending_to_assign';

    -- Set item_status to 'on_route' for orders assigned to trips in on-route status
    UPDATE trip_orders
    SET item_status = 'on_route'
    WHERE EXISTS (
        SELECT 1 FROM trips t
        WHERE t.id = trip_orders.trip_id AND t.status = 'on-route'
    ) AND trip_orders.item_status = 'pending_to_assign';

    -- Set item_status to 'delivered' for orders assigned to completed trips
    UPDATE trip_orders
    SET item_status = 'delivered'
    WHERE EXISTS (
        SELECT 1 FROM trips t
        WHERE t.id = trip_orders.trip_id AND t.status = 'completed'
    ) AND trip_orders.item_status = 'pending_to_assign';
END $$;

-- Step 3: Create index for faster queries on item_status
CREATE INDEX IF NOT EXISTS idx_trip_orders_item_status ON trip_orders(item_status);

-- Verification query - shows item status distribution
SELECT
    'Migration completed successfully!' as status,
    item_status,
    COUNT(*) as count
FROM trip_orders
GROUP BY item_status
ORDER BY item_status;
