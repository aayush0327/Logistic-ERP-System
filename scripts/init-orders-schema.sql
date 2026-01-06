-- Orders Service Database Schema Initialization
-- This file will be executed after the auth schema is created

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create function to automatically update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(255) PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    tenant_id VARCHAR(255) NOT NULL, -- References tenants table in auth_db (handled at application level)
    customer_id VARCHAR(255) NOT NULL,
    branch_id VARCHAR(255) NOT NULL,
    order_type VARCHAR(20) NOT NULL DEFAULT 'delivery',
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    priority VARCHAR(20) NOT NULL DEFAULT 'normal',
    tms_order_status VARCHAR(50) DEFAULT 'available' CHECK (
        tms_order_status IN ('available', 'partial', 'fully_assigned')
    ),

    -- Pickup information
    pickup_address TEXT,
    pickup_contact_name VARCHAR(100),
    pickup_contact_phone VARCHAR(20),
    pickup_city VARCHAR(100),
    pickup_state VARCHAR(100),
    pickup_pincode VARCHAR(20),

    -- Delivery information
    delivery_address TEXT,
    delivery_contact_name VARCHAR(100),
    delivery_contact_phone VARCHAR(20),
    delivery_city VARCHAR(100),
    delivery_state VARCHAR(100),
    delivery_pincode VARCHAR(20),

    -- Weight and dimensions
    total_weight NUMERIC(10, 2),
    total_volume NUMERIC(10, 2),
    package_count INTEGER,

    -- Financial information
    total_amount NUMERIC(12, 2),
    payment_type VARCHAR(20),

    -- Special requirements
    special_instructions TEXT,
    delivery_instructions TEXT,

    -- System fields
    created_by VARCHAR(255) NOT NULL,
    updated_by VARCHAR(255),
    finance_approved_by VARCHAR(255),
    logistics_approved_by VARCHAR(255),
    driver_id VARCHAR(255),
    trip_id VARCHAR(255),

    -- Dates
    pickup_date TIMESTAMP WITH TIME ZONE,
    delivery_date TIMESTAMP WITH TIME ZONE,
    finance_approved_at TIMESTAMP WITH TIME ZONE,
    logistics_approved_at TIMESTAMP WITH TIME ZONE,
    picked_up_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,

    -- Rejection information
    finance_rejected_reason TEXT,
    logistics_rejected_reason TEXT,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
    id VARCHAR(255) PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id VARCHAR(255) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id VARCHAR(255) NOT NULL,
    product_name VARCHAR(200) NOT NULL,
    product_code VARCHAR(100),
    description TEXT,
    quantity INTEGER NOT NULL,
    unit VARCHAR(50) NOT NULL DEFAULT 'pcs',
    unit_price NUMERIC(10, 2),
    total_price NUMERIC(12, 2),
    weight NUMERIC(10, 2),
    volume NUMERIC(10, 2),
    dimensions_length NUMERIC(8, 2),
    dimensions_width NUMERIC(8, 2),
    dimensions_height NUMERIC(8, 2),
    item_status VARCHAR(50) DEFAULT 'pending_to_assign' CHECK (
        item_status IN ('pending_to_assign', 'planning', 'loading', 'on_route', 'delivered', 'failed', 'returned')
    ),
    trip_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create order_documents table
-- Supported document_type values: 'invoice', 'packing_list', 'delivery_note', 'delivery_proof',
-- 'purchase_order', 'quotation', 'contract', 'receipt', 'other'
CREATE TABLE IF NOT EXISTS order_documents (
    id VARCHAR(255) PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id VARCHAR(255) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    uploaded_by VARCHAR(255) NOT NULL,
    document_type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_hash VARCHAR(64),
    is_required BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false,
    verified_by VARCHAR(255),
    verified_at TIMESTAMP WITH TIME ZONE,
    verification_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create order_status_history table
CREATE TABLE IF NOT EXISTS order_status_history (
    id VARCHAR(255) PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id VARCHAR(255) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    changed_by VARCHAR(255) NOT NULL,
    from_status VARCHAR(50),
    to_status VARCHAR(50) NOT NULL,
    reason TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_branch_id ON orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_tms_order_status ON orders(tms_order_status);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_trip_id ON orders(trip_id);
CREATE INDEX IF NOT EXISTS idx_orders_is_active ON orders(is_active);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_item_status ON order_items(item_status);
CREATE INDEX IF NOT EXISTS idx_order_items_trip_id ON order_items(trip_id);

CREATE INDEX IF NOT EXISTS idx_order_documents_order_id ON order_documents(order_id);
CREATE INDEX IF NOT EXISTS idx_order_documents_uploaded_by ON order_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_order_documents_file_hash ON order_documents(file_hash);
CREATE INDEX IF NOT EXISTS idx_order_documents_is_verified ON order_documents(is_verified);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_created_at ON order_status_history(created_at);

-- Create trip_item_assignments junction table for tracking split/partial item assignments
CREATE TABLE IF NOT EXISTS trip_item_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id VARCHAR(50) NOT NULL,  -- TMS trip ID (e.g., TRIP-XXXX)
    order_id VARCHAR(255) NOT NULL,  -- Order UUID from orders table
    order_item_id VARCHAR(255) NOT NULL,  -- Order item UUID from order_items table
    order_number VARCHAR(50) NOT NULL,  -- Order number for easy lookup (e.g., ORD-2026...)
    tenant_id VARCHAR(255) NOT NULL,

    -- Assignment details
    assigned_quantity INTEGER NOT NULL,  -- Quantity assigned to this trip
    item_status VARCHAR(50) DEFAULT 'pending_to_assign' CHECK (
        item_status IN ('pending_to_assign', 'planning', 'loading', 'on_route', 'delivered', 'failed', 'returned')
    ),

    -- Timestamps
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Unique constraint: Same item can only be assigned once to the same trip
    UNIQUE(trip_id, order_item_id)
);

-- Add comments for documentation
COMMENT ON TABLE trip_item_assignments IS 'Junction table tracking which order items are assigned to which trips with quantities';
COMMENT ON COLUMN trip_item_assignments.assigned_quantity IS 'Quantity of this item assigned to this trip';
COMMENT ON COLUMN trip_item_assignments.item_status IS 'Current status of this item assignment';

-- Create indexes for trip_item_assignments
CREATE INDEX IF NOT EXISTS idx_trip_item_assignments_trip_id ON trip_item_assignments(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_item_assignments_order_id ON trip_item_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_trip_item_assignments_order_item_id ON trip_item_assignments(order_item_id);
CREATE INDEX IF NOT EXISTS idx_trip_item_assignments_order_number ON trip_item_assignments(order_number);
CREATE INDEX IF NOT EXISTS idx_trip_item_assignments_tenant_id ON trip_item_assignments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_trip_item_assignments_item_status ON trip_item_assignments(item_status);
CREATE INDEX IF NOT EXISTS idx_trip_item_assignments_trip_status ON trip_item_assignments(trip_id, item_status);
CREATE INDEX IF NOT EXISTS idx_trip_item_assignments_order_trip ON trip_item_assignments(order_id, trip_id);

-- Create triggers to update updated_at
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_order_items_updated_at BEFORE UPDATE ON order_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_order_documents_updated_at BEFORE UPDATE ON order_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_trip_item_assignments_updated_at BEFORE UPDATE ON trip_item_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create sequence for order numbers
CREATE SEQUENCE IF NOT EXISTS order_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Create function to generate order numbers
CREATE OR REPLACE FUNCTION generate_order_number(p_tenant_id VARCHAR(255))
RETURNS VARCHAR AS $$
DECLARE
    v_date_prefix VARCHAR(8);
    v_sequence_num INTEGER;
    v_order_number VARCHAR(50);
BEGIN
    -- Get date prefix (YYYYMMDD)
    v_date_prefix := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');

    -- Reset sequence daily
    PERFORM setval('order_number_seq', 1, false);

    -- Get next sequence number
    v_sequence_num := nextval('order_number_seq');

    -- Generate order number
    v_order_number := 'ORD' || v_date_prefix || LPAD(v_sequence_num::TEXT, 4, '0');

    -- Ensure uniqueness
    WHILE EXISTS (SELECT 1 FROM orders WHERE order_number = v_order_number) LOOP
        v_sequence_num := nextval('order_number_seq');
        v_order_number := 'ORD' || v_date_prefix || LPAD(v_sequence_num::TEXT, 4, '0');
    END LOOP;

    RETURN v_order_number;
END;
$$ LANGUAGE plpgsql;

-- Create function to update item statuses for an order (called by TMS service)
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

-- Create function to update specific items by IDs (for partial order updates)
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

-- Create trigger to automatically update order status based on item statuses
-- NOTE: 'loading' item status does NOT change order status (orders stay in their current state like 'finance_approved')
-- Handles split orders with partial_in_transit and partial_delivered statuses
-- Handles partial quantity assignments via trip_item_assignments table
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
    -- KEY: Check partial assignments FIRST, before checking if all delivered

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

-- Create trigger for automatic order status updates on order_items
CREATE TRIGGER trigger_update_order_status_from_items
    AFTER INSERT OR UPDATE OF item_status ON order_items
    FOR EACH ROW
    EXECUTE FUNCTION update_order_status_from_items();

-- Create trigger for automatic order status updates on trip_item_assignments (for partial quantity tracking)
CREATE TRIGGER trigger_update_order_status_from_trip_assignments
    AFTER INSERT OR UPDATE OF item_status ON trip_item_assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_order_status_from_items();

-- Grant permissions to the application user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;