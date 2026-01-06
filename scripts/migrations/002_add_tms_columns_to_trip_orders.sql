-- Migration: Add TMS tracking columns to trip_orders table
-- Database: tms_db
-- This migration adds tms_order_status, items_json, and remaining_items_json columns
-- to track TMS-specific order status and item assignments

-- Add tms_order_status column to trip_orders table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'trip_orders'
        AND column_name = 'tms_order_status'
    ) THEN
        ALTER TABLE trip_orders ADD COLUMN tms_order_status VARCHAR(50) DEFAULT 'available'
        CHECK (tms_order_status IN ('available', 'partial', 'fully_assigned'));

        COMMENT ON COLUMN trip_orders.tms_order_status IS 'TMS-specific status: available (not assigned), partial (some items assigned), fully_assigned (all items assigned)';
    END IF;
END $$;

-- Add items_json column to store assigned items
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'trip_orders'
        AND column_name = 'items_json'
    ) THEN
        ALTER TABLE trip_orders ADD COLUMN items_json JSONB;

        COMMENT ON COLUMN trip_orders.items_json IS 'JSON array of items assigned to this trip';
    END IF;
END $$;

-- Add remaining_items_json column to store unassigned items
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'trip_orders'
        AND column_name = 'remaining_items_json'
    ) THEN
        ALTER TABLE trip_orders ADD COLUMN remaining_items_json JSONB;

        COMMENT ON COLUMN trip_orders.remaining_items_json IS 'JSON array of items remaining after partial assignment';
    END IF;
END $$;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_trip_orders_tms_status ON trip_orders(tms_order_status);
CREATE INDEX IF NOT EXISTS idx_trip_orders_original_order_id ON trip_orders(original_order_id);

-- Verify the migration
SELECT
    'TMS DB Migration completed successfully!' as status,
    COUNT(*) as trip_orders_with_tms_status
FROM trip_orders
WHERE tms_order_status IS NOT NULL;
