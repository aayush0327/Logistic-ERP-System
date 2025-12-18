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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create order_documents table
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
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_trip_id ON orders(trip_id);
CREATE INDEX IF NOT EXISTS idx_orders_is_active ON orders(is_active);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

CREATE INDEX IF NOT EXISTS idx_order_documents_order_id ON order_documents(order_id);
CREATE INDEX IF NOT EXISTS idx_order_documents_uploaded_by ON order_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_order_documents_file_hash ON order_documents(file_hash);
CREATE INDEX IF NOT EXISTS idx_order_documents_is_verified ON order_documents(is_verified);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_created_at ON order_status_history(created_at);

-- Create triggers to update updated_at
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_order_items_updated_at BEFORE UPDATE ON order_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_order_documents_updated_at BEFORE UPDATE ON order_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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

-- Grant permissions to the application user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;