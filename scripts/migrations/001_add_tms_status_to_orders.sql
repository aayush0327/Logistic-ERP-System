-- Migration: Add TMS order status tracking to Orders Database
-- Database: orders_db
-- This migration adds tms_order_status, items_json, and remaining_items_json columns

-- Add tms_order_status column to orders table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders'
        AND column_name = 'tms_order_status'
    ) THEN
        ALTER TABLE orders ADD COLUMN tms_order_status VARCHAR(50) DEFAULT 'available'
        CHECK (tms_order_status IN ('available', 'partial', 'fully_assigned'));

        COMMENT ON COLUMN orders.tms_order_status IS 'TMS-specific status: available (not assigned to any trip), partial (some items assigned to trip), fully_assigned (all items assigned)';
    END IF;
END $$;

-- Add items_json column to store assigned items
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders'
        AND column_name = 'items_json'
    ) THEN
        ALTER TABLE orders ADD COLUMN items_json JSONB;

        COMMENT ON COLUMN orders.items_json IS 'JSON array of items assigned to trip';
    END IF;
END $$;

-- Add remaining_items_json column to store unassigned items
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'orders'
        AND column_name = 'remaining_items_json'
    ) THEN
        ALTER TABLE orders ADD COLUMN remaining_items_json JSONB;

        COMMENT ON COLUMN orders.remaining_items_json IS 'JSON array of items remaining after partial assignment';
    END IF;
END $$;

-- Create index for faster queries on tms_order_status
CREATE INDEX IF NOT EXISTS idx_orders_tms_order_status ON orders(tms_order_status);

-- Verify the migration
SELECT
    'Orders DB Migration completed successfully!' as status,
    COUNT(*) as orders_with_tms_status
FROM orders
WHERE tms_order_status IS NOT NULL;
