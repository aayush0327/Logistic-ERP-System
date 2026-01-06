-- Debug query to check item statuses for an order and see what the trigger will do
-- Replace 'YOUR_ORDER_NUMBER' with the actual order number (e.g., 'ORD20260105001')

-- Query 1: Summary of order and trigger evaluation
SELECT
    o.id as order_id,
    o.order_number,
    o.status as current_order_status,
    COUNT(*) as total_items,
    STRING_AGG(DISTINCT oi.item_status, ', ') as all_item_statuses,
    -- Item counts by status
    COUNT(CASE WHEN oi.item_status = 'pending_to_assign' THEN 1 END) as pending_count,
    COUNT(CASE WHEN oi.item_status = 'planning' THEN 1 END) as planning_count,
    COUNT(CASE WHEN oi.item_status = 'loading' THEN 1 END) as loading_count,
    COUNT(CASE WHEN oi.item_status = 'on_route' THEN 1 END) as on_route_count,
    COUNT(CASE WHEN oi.item_status = 'delivered' THEN 1 END) as delivered_count,
    -- Trigger logic evaluation (what the trigger checks)
    BOOL_AND(oi.item_status = 'delivered') as trigger_all_delivered,
    BOOL_AND(oi.item_status IN ('on_route', 'delivered')) as trigger_all_on_route,
    BOOL_OR(oi.item_status = 'delivered') as trigger_any_delivered,
    BOOL_OR(oi.item_status = 'on_route') as trigger_any_on_route,
    BOOL_OR(oi.item_status = 'loading') as trigger_any_loading,
    BOOL_OR(oi.item_status = 'planning') as trigger_any_planning,
    BOOL_OR(oi.item_status = 'pending_to_assign') as trigger_any_pending,
    -- What status the trigger will set
    CASE
        WHEN BOOL_AND(oi.item_status = 'delivered') THEN 'delivered'
        WHEN BOOL_OR(oi.item_status = 'delivered') AND (BOOL_OR(oi.item_status IN ('on_route', 'loading', 'planning', 'pending_to_assign'))) THEN 'partial_delivered'
        WHEN BOOL_AND(oi.item_status IN ('on_route', 'delivered')) THEN 'in_transit'
        WHEN BOOL_OR(oi.item_status = 'on_route') AND (BOOL_OR(oi.item_status IN ('loading', 'planning', 'pending_to_assign'))) THEN 'partial_in_transit'
        WHEN BOOL_OR(oi.item_status = 'planning') THEN 'assigned'
        ELSE 'no_change'
    END as trigger_will_set_status
FROM orders o
LEFT JOIN order_items oi ON o.id = oi.order_id
WHERE o.order_number = 'YOUR_ORDER_NUMBER'  -- REPLACE THIS
GROUP BY o.id, o.order_number, o.status;

-- Query 2: Detailed item breakdown
SELECT
    o.order_number,
    oi.id as item_id,
    oi.product_name,
    oi.quantity,
    oi.item_status,
    oi.trip_id,
    CASE oi.item_status
        WHEN 'pending_to_assign' THEN 'Not assigned to any trip'
        WHEN 'planning' THEN 'Assigned to trip, in planning phase'
        WHEN 'loading' THEN 'Being loaded onto truck'
        WHEN 'on_route' THEN 'In transit to delivery location'
        WHEN 'delivered' THEN 'Successfully delivered'
        ELSE oi.item_status
    END as status_description
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
WHERE o.order_number = 'YOUR_ORDER_NUMBER'  -- REPLACE THIS
ORDER BY
    CASE oi.item_status
        WHEN 'pending_to_assign' THEN 1
        WHEN 'planning' THEN 2
        WHEN 'loading' THEN 3
        WHEN 'on_route' THEN 4
        WHEN 'delivered' THEN 5
        ELSE 6
    END;

-- Query 3: Check all orders with problematic status combinations
-- (Find orders that might be in wrong status)
SELECT
    o.order_number,
    o.status as order_status,
    COUNT(*) as total_items,
    STRING_AGG(DISTINCT oi.item_status, ', ') as item_statuses,
    CASE
        WHEN o.status = 'in_transit' AND NOT BOOL_AND(oi.item_status IN ('on_route', 'delivered')) THEN 'WARNING: Order is in_transit but not all items are on_route or delivered!'
        WHEN o.status = 'delivered' AND NOT BOOL_AND(oi.item_status = 'delivered') THEN 'WARNING: Order is delivered but not all items are delivered!'
        WHEN o.status = 'partial_in_transit' AND BOOL_AND(oi.item_status IN ('on_route', 'delivered')) THEN 'WARNING: Order is partial_in_transit but all items are on_route/delivered!'
        WHEN o.status = 'partial_delivered' AND NOT BOOL_OR(oi.item_status = 'delivered') THEN 'WARNING: Order is partial_delivered but no items are delivered!'
        ELSE 'OK'
    END as validation_result
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
WHERE o.status IN ('in_transit', 'partial_in_transit', 'partial_delivered', 'delivered')
GROUP BY o.order_number, o.status
HAVING (
    (o.status = 'in_transit' AND NOT BOOL_AND(oi.item_status IN ('on_route', 'delivered'))) OR
    (o.status = 'delivered' AND NOT BOOL_AND(oi.item_status = 'delivered')) OR
    (o.status = 'partial_in_transit' AND BOOL_AND(oi.item_status IN ('on_route', 'delivered'))) OR
    (o.status = 'partial_delivered' AND NOT BOOL_OR(oi.item_status = 'delivered'))
)
ORDER BY o.order_number;