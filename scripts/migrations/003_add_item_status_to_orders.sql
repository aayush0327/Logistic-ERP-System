-- Migration: Add Item-Level Status Tracking to Orders Database
-- Database: orders_db
-- This migration adds item_status and trip_id columns to order_items table
-- Status values: pending_to_assign, planning, loading, on_route, delivered, failed, returned

-- Step 1: Add item_status column to order_items table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'order_items'
        AND column_name = 'item_status'
    ) THEN
        ALTER TABLE order_items ADD COLUMN item_status VARCHAR(50) DEFAULT 'pending_to_assign' CHECK (
            item_status IN ('pending_to_assign', 'planning', 'loading', 'on_route', 'delivered', 'failed', 'returned')
        );

        COMMENT ON COLUMN order_items.item_status IS 'Item status tracking: pending_to_assign (not assigned to trip), planning (assigned to trip), loading (being loaded), on_route (in transit), delivered (completed), failed (delivery failed), returned (returned to sender)';
    END IF;
END $$;

-- Step 2: Add trip_id column to order_items to track which trip the item is assigned to
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'order_items'
        AND column_name = 'trip_id'
    ) THEN
        ALTER TABLE order_items ADD COLUMN trip_id VARCHAR(255);

        COMMENT ON COLUMN order_items.trip_id IS 'ID of the trip this item is assigned to (from TMS service) - updated when TMS service calls Orders API';
    END IF;
END $$;

-- Step 3: Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_order_items_item_status ON order_items(item_status);
CREATE INDEX IF NOT EXISTS idx_order_items_trip_id ON order_items(trip_id);

-- Step 4: Create function to update item statuses for an order (called by TMS service)
CREATE OR REPLACE FUNCTION update_order_items_status(
    p_order_id VARCHAR,
    p_trip_id VARCHAR,
    p_new_status VARCHAR
) RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    -- Update items status for this order
    UPDATE order_items
    SET item_status = p_new_status,
        trip_id = COALESCE(p_trip_id, trip_id)
    WHERE order_id = p_order_id
    AND p_new_status IN ('pending_to_assign', 'planning', 'loading', 'on_route', 'delivered', 'failed', 'returned');

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create function to update specific items by IDs (for partial order updates)
CREATE OR REPLACE FUNCTION update_specific_items_status(
    p_item_ids VARCHAR[],
    p_trip_id VARCHAR,
    p_new_status VARCHAR
) RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE order_items
    SET item_status = p_new_status,
        trip_id = COALESCE(p_trip_id, trip_id)
    WHERE id = ANY(p_item_ids)
    AND p_new_status IN ('pending_to_assign', 'planning', 'loading', 'on_route', 'delivered', 'failed', 'returned');

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create trigger to automatically update order status based on item statuses
CREATE OR REPLACE FUNCTION update_order_status_from_items()
RETURNS TRIGGER AS $$
DECLARE
    all_delivered BOOLEAN;
    any_on_route BOOLEAN;
    any_loading BOOLEAN;
    any_planning BOOLEAN;
    order_current_status VARCHAR(50);
BEGIN
    -- Get current order status
    SELECT status INTO order_current_status
    FROM orders
    WHERE id = NEW.order_id;

    -- Skip if order is already delivered or cancelled
    IF order_current_status IN ('delivered', 'cancelled') THEN
        RETURN NEW;
    END IF;

    -- Check item statuses
    SELECT BOOL_AND(item_status = 'delivered') INTO all_delivered
    FROM order_items
    WHERE order_id = NEW.order_id;

    SELECT BOOL_OR(item_status = 'on_route') INTO any_on_route
    FROM order_items
    WHERE order_id = NEW.order_id;

    SELECT BOOL_OR(item_status = 'loading') INTO any_loading
    FROM order_items
    WHERE order_id = NEW.order_id;

    SELECT BOOL_OR(item_status = 'planning') INTO any_planning
    FROM order_items
    WHERE order_id = NEW.order_id;

    -- Update the parent order status based on item statuses
    IF all_delivered THEN
        UPDATE orders
        SET status = 'delivered',
            delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP)
        WHERE id = NEW.order_id AND status != 'delivered';
    ELSIF any_on_route THEN
        UPDATE orders
        SET status = 'in_transit'
        WHERE id = NEW.order_id AND status NOT IN ('in_transit', 'delivered');
    ELSIF any_loading THEN
        UPDATE orders
        SET status = 'picked_up'
        WHERE id = NEW.order_id AND status NOT IN ('picked_up', 'in_transit', 'delivered');
    ELSIF any_planning THEN
        UPDATE orders
        SET status = 'assigned'
        WHERE id = NEW.order_id AND status = 'submitted';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic order status updates
DROP TRIGGER IF EXISTS trigger_update_order_status_from_items ON order_items;
CREATE TRIGGER trigger_update_order_status_from_items
    AFTER INSERT OR UPDATE OF item_status ON order_items
    FOR EACH ROW
    EXECUTE FUNCTION update_order_status_from_items();

-- Verification query
SELECT
    'Migration completed successfully!' as status,
    item_status,
    COUNT(*) as item_count
FROM order_items
GROUP BY item_status
ORDER BY item_status;
