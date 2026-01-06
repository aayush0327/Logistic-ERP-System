-- Migration: Fix Order Status Trigger - Handle Partial Quantities Correctly
-- Database: orders_db
-- This migration fixes the logic order to check partial assignments BEFORE checking fully delivered

-- Drop the existing triggers
DROP TRIGGER IF EXISTS trigger_update_order_status_from_items ON order_items;
DROP TRIGGER IF EXISTS trigger_update_order_status_from_trip_assignments ON trip_item_assignments;

-- Recreate the function with CORRECTED logic order for partial quantities
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
    has_partial_assignment BOOLEAN;
    total_items INTEGER;
    order_current_status VARCHAR(50);
    order_id_to_check VARCHAR;
BEGIN
    -- Determine which order_id to check (could be from order_items or trip_item_assignments)
    IF TG_TABLE_NAME = 'trip_item_assignments' THEN
        order_id_to_check := NEW.order_id;
    ELSE
        order_id_to_check := NEW.order_id;
    END IF;

    -- Get current order status
    SELECT status INTO order_current_status
    FROM orders
    WHERE id = order_id_to_check;

    -- Skip if order is already delivered or cancelled
    IF order_current_status IN ('delivered', 'cancelled') THEN
        RETURN NEW;
    END IF;

    -- FIXED: Check if there are partial assignments by summing assigned quantities
    -- If total assigned quantity < total order quantity, there's a partial assignment
    SELECT COALESCE(SUM(oi.quantity) > COALESCE(SUM(tia.assigned_quantity), 0), FALSE)
    INTO has_partial_assignment
    FROM order_items oi
    LEFT JOIN trip_item_assignments tia ON tia.order_item_id = oi.id AND tia.order_id = oi.order_id
    WHERE oi.order_id = order_id_to_check;

    -- If no trip_item_assignments exist yet, set to false
    IF has_partial_assignment IS NULL THEN
        has_partial_assignment := FALSE;
    END IF;

    -- Check item statuses across all items (from order_items table)
    SELECT BOOL_AND(item_status = 'delivered') INTO all_delivered
    FROM order_items
    WHERE order_id = order_id_to_check;

    SELECT BOOL_AND(item_status IN ('on_route', 'delivered')) INTO all_on_route
    FROM order_items
    WHERE order_id = order_id_to_check;

    SELECT BOOL_OR(item_status = 'delivered') INTO any_delivered
    FROM order_items
    WHERE order_id = order_id_to_check;

    SELECT BOOL_OR(item_status = 'on_route') INTO any_on_route
    FROM order_items
    WHERE order_id = order_id_to_check;

    SELECT BOOL_OR(item_status = 'loading') INTO any_loading
    FROM order_items
    WHERE order_id = order_id_to_check;

    SELECT BOOL_OR(item_status = 'planning') INTO any_planning
    FROM order_items
    WHERE order_id = order_id_to_check;

    SELECT BOOL_OR(item_status = 'pending_to_assign') INTO any_pending
    FROM order_items
    WHERE order_id = order_id_to_check;

    -- Update the parent order status based on item statuses and partial assignments
    -- Priority: partial_delivered > delivered > in_transit > partial_in_transit > assigned
    -- KEY FIX: Check partial assignments FIRST, before checking if all delivered

    IF has_partial_assignment AND any_delivered THEN
        -- Has partial quantity assignments AND some items delivered
        UPDATE orders
        SET status = 'partial_delivered'
        WHERE id = order_id_to_check AND status != 'partial_delivered';

    ELSIF has_partial_assignment AND any_on_route THEN
        -- Has partial quantity assignments - treat as partial_in_transit
        UPDATE orders
        SET status = 'partial_in_transit'
        WHERE id = order_id_to_check AND status NOT IN ('partial_in_transit', 'in_transit', 'partial_delivered', 'delivered');

    ELSIF has_partial_assignment AND (any_loading OR any_planning OR any_pending) THEN
        -- Has partial quantity assignments but not yet on route
        UPDATE orders
        SET status = 'assigned'
        WHERE id = order_id_to_check AND status = 'submitted';

    ELSIF all_delivered AND NOT has_partial_assignment THEN
        -- All items are FULLY delivered (no partials)
        UPDATE orders
        SET status = 'delivered',
            delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP)
        WHERE id = order_id_to_check AND status != 'delivered';

    ELSIF any_delivered AND (any_on_route OR any_loading OR any_planning OR any_pending) THEN
        -- Some items delivered, others still in transit/loading/planning
        UPDATE orders
        SET status = 'partial_delivered'
        WHERE id = order_id_to_check AND status NOT IN ('partial_delivered', 'delivered');

    ELSIF all_on_route AND NOT (any_loading OR any_planning OR any_pending OR has_partial_assignment) THEN
        -- All items are fully on-route or delivered (no partials, no remaining)
        UPDATE orders
        SET status = 'in_transit'
        WHERE id = order_id_to_check AND status NOT IN ('in_transit', 'partial_delivered', 'delivered');

    ELSIF any_on_route AND (any_loading OR any_planning OR any_pending) THEN
        -- Some items on-route, others still loading/planning/pending
        UPDATE orders
        SET status = 'partial_in_transit'
        WHERE id = order_id_to_check AND status NOT IN ('partial_in_transit', 'in_transit', 'partial_delivered', 'delivered');

    ELSIF any_planning THEN
        -- Items are in planning phase
        UPDATE orders
        SET status = 'assigned'
        WHERE id = order_id_to_check AND status = 'submitted';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on order_items
CREATE TRIGGER trigger_update_order_status_from_items
    AFTER INSERT OR UPDATE OF item_status ON order_items
    FOR EACH ROW
    EXECUTE FUNCTION update_order_status_from_items();

-- Create trigger on trip_item_assignments as well (for partial quantity updates)
CREATE TRIGGER trigger_update_order_status_from_trip_assignments
    AFTER INSERT OR UPDATE OF item_status ON trip_item_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_order_status_from_items();

-- Verification query
SELECT
    'Migration completed successfully!' as status,
    'Trigger updated to check partial assignments FIRST (before fully delivered)' as description;
