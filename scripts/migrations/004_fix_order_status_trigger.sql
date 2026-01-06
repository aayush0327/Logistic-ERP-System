-- Migration: Fix Order Status Trigger - Handle loading and split orders properly
-- Database: orders_db
-- This migration modifies the trigger to:
-- 1. NOT update order status when item_status is 'loading'
-- 2. Add support for partial_in_transit and partial_delivered statuses for split orders

-- Drop the existing trigger
DROP TRIGGER IF EXISTS trigger_update_order_status_from_items ON order_items;

-- Recreate the function with updated logic for split orders
CREATE OR REPLACE FUNCTION update_order_status_from_items()
RETURNS TRIGGER AS $$
DECLARE
    all_delivered BOOLEAN;
    all_on_route BOOLEAN;
    any_delivered BOOLEAN;
    any_on_route BOOLEAN;
    any_loading BOOLEAN;
    any_planning BOOLEAN;
    any_pending BOOLEAN;
    total_items INTEGER;
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

    -- Get total items count
    SELECT COUNT(*) INTO total_items
    FROM order_items
    WHERE order_id = NEW.order_id;

    -- Check item statuses across all items
    SELECT BOOL_AND(item_status = 'delivered') INTO all_delivered
    FROM order_items
    WHERE order_id = NEW.order_id;

    SELECT BOOL_AND(item_status IN ('on_route', 'delivered')) INTO all_on_route
    FROM order_items
    WHERE order_id = NEW.order_id;

    SELECT BOOL_OR(item_status = 'delivered') INTO any_delivered
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

    SELECT BOOL_OR(item_status = 'pending_to_assign') INTO any_pending
    FROM order_items
    WHERE order_id = NEW.order_id;

    -- Update the parent order status based on item statuses
    -- Priority: delivered > partial_delivered > in_transit > partial_in_transit > assigned
    -- NOTE: 'loading' item status does NOT change order status

    IF all_delivered THEN
        -- All items are delivered
        UPDATE orders
        SET status = 'delivered',
            delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP)
        WHERE id = NEW.order_id AND status != 'delivered';

    ELSIF any_delivered AND (any_on_route OR any_loading OR any_planning OR any_pending) THEN
        -- Some items delivered, but others still in transit/loading/planning
        UPDATE orders
        SET status = 'partial_delivered'
        WHERE id = NEW.order_id AND status NOT IN ('partial_delivered', 'delivered');

    ELSIF all_on_route THEN
        -- All items are on-route or delivered
        UPDATE orders
        SET status = 'in_transit'
        WHERE id = NEW.order_id AND status NOT IN ('in_transit', 'partial_delivered', 'delivered');

    ELSIF any_on_route AND (any_loading OR any_planning OR any_pending) THEN
        -- Some items on-route, others still loading/planning/pending
        UPDATE orders
        SET status = 'partial_in_transit'
        WHERE id = NEW.order_id AND status NOT IN ('partial_in_transit', 'in_transit', 'partial_delivered', 'delivered');

    ELSIF any_planning THEN
        -- Items are in planning phase
        UPDATE orders
        SET status = 'assigned'
        WHERE id = NEW.order_id AND status = 'submitted';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic order status updates
CREATE TRIGGER trigger_update_order_status_from_items
    AFTER INSERT OR UPDATE OF item_status ON order_items
    FOR EACH ROW
    EXECUTE FUNCTION update_order_status_from_items();

-- Verification query
SELECT
    'Migration completed successfully!' as status,
    'Trigger updated to handle loading and split orders (partial_in_transit, partial_delivered)' as description;