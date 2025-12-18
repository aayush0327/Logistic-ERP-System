-- TMS (Transport Management System) Database Schema
-- This schema stores only trip planning and order allocation data
-- Other data (trucks, drivers, orders, branches) will be dummy data from other services

-- Core Trips Table
CREATE TABLE IF NOT EXISTS trips (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    company_id VARCHAR(50) NOT NULL,
    branch VARCHAR(100) NOT NULL,
    truck_plate VARCHAR(20) NOT NULL,
    truck_model VARCHAR(100) NOT NULL,
    truck_capacity INTEGER NOT NULL,
    driver_id VARCHAR(50) NOT NULL,
    driver_name VARCHAR(100) NOT NULL,
    driver_phone VARCHAR(20) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'planning' CHECK (
        status IN ('planning', 'loading', 'on-route', 'completed', 'cancelled', 'truck-malfunction')
    ),
    origin VARCHAR(100),
    destination VARCHAR(100),
    distance INTEGER,
    estimated_duration INTEGER,
    pre_trip_time INTEGER DEFAULT 30,
    post_trip_time INTEGER DEFAULT 15,
    capacity_used INTEGER DEFAULT 0,
    capacity_total INTEGER NOT NULL,
    trip_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Trip Orders Allocation Table
CREATE TABLE IF NOT EXISTS trip_orders (
    id SERIAL PRIMARY KEY,
    trip_id VARCHAR(50) NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id VARCHAR(50) NOT NULL,
    company_id VARCHAR(50) NOT NULL,
    order_id VARCHAR(50) NOT NULL,
    customer VARCHAR(200) NOT NULL,
    customer_address TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'assigned' CHECK (
        status IN ('assigned', 'loading', 'on-route', 'completed')
    ),
    delivery_status VARCHAR(50) DEFAULT 'pending' CHECK (
        delivery_status IN ('pending', 'out-for-delivery', 'delivered', 'failed', 'returned')
    ),
    total DECIMAL(12,2) NOT NULL,
    weight INTEGER NOT NULL,
    volume INTEGER NOT NULL,
    items INTEGER NOT NULL,
    priority VARCHAR(20) NOT NULL CHECK (
        priority IN ('high', 'medium', 'low')
    ),
    sequence_number INTEGER NOT NULL DEFAULT 0, -- Delivery sequence for drag & drop ordering
    address TEXT,
    assigned_at TIMESTAMP DEFAULT NOW(),
    original_order_id VARCHAR(50), -- For split orders
    original_items INTEGER,        -- For split orders
    original_weight INTEGER       -- For split orders
);

-- Trip Routes Table (for delivery sequence)
CREATE TABLE IF NOT EXISTS trip_routes (
    id SERIAL PRIMARY KEY,
    trip_id VARCHAR(50) NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id VARCHAR(50) NOT NULL,
    company_id VARCHAR(50) NOT NULL,
    sequence_number INTEGER NOT NULL,
    order_id INTEGER REFERENCES trip_orders(id),
    location VARCHAR(200) NOT NULL,
    estimated_arrival TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending' CHECK (
        status IN ('pending', 'in-progress', 'completed')
    ),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS tms_audit_logs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    company_id VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    module VARCHAR(50) NOT NULL DEFAULT 'TMS',
    record_id VARCHAR(50),
    record_type VARCHAR(50), -- 'trip' or 'trip_order'
    details TEXT,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_date ON trips(trip_date);
CREATE INDEX IF NOT EXISTS idx_trips_branch ON trips(branch);
CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id);
CREATE INDEX IF NOT EXISTS idx_trips_company_id ON trips(company_id);
CREATE INDEX IF NOT EXISTS idx_trips_user_company ON trips(user_id, company_id);
CREATE INDEX IF NOT EXISTS idx_trip_orders_trip_id ON trip_orders(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_orders_order_id ON trip_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_trip_orders_priority ON trip_orders(priority);
CREATE INDEX IF NOT EXISTS idx_trip_orders_sequence ON trip_orders(trip_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_trip_orders_user_id ON trip_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_trip_orders_company_id ON trip_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_trip_orders_user_company ON trip_orders(user_id, company_id);
CREATE INDEX IF NOT EXISTS idx_trip_routes_trip_id ON trip_routes(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_routes_user_id ON trip_routes(user_id);
CREATE INDEX IF NOT EXISTS idx_trip_routes_company_id ON trip_routes(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record ON tms_audit_logs(record_type, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON tms_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON tms_audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_company ON tms_audit_logs(user_id, company_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at on trips table
DROP TRIGGER IF EXISTS update_trips_updated_at ON trips;
CREATE TRIGGER update_trips_updated_at
    BEFORE UPDATE ON trips
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to log trip changes
CREATE OR REPLACE FUNCTION log_trip_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO tms_audit_logs (user_id, company_id, action, module, record_id, record_type, details)
        VALUES (NEW.user_id, NEW.company_id, 'CREATE', 'TMS', NEW.id, 'trip',
                CONCAT('Created trip: ', NEW.id, ' for branch: ', NEW.branch));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status != NEW.status THEN
            INSERT INTO tms_audit_logs (user_id, company_id, action, module, record_id, record_type, details)
            VALUES (NEW.user_id, NEW.company_id, 'UPDATE', 'TMS', NEW.id, 'trip',
                    CONCAT('Trip status changed from: ', OLD.status, ' to: ', NEW.status));
        END IF;
        IF OLD.capacity_used != NEW.capacity_used THEN
            INSERT INTO tms_audit_logs (user_id, company_id, action, module, record_id, record_type, details)
            VALUES (NEW.user_id, NEW.company_id, 'UPDATE', 'TMS', NEW.id, 'trip',
                    CONCAT('Trip capacity changed from: ', OLD.capacity_used, 'kg to: ', NEW.capacity_used, 'kg'));
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO tms_audit_logs (user_id, company_id, action, module, record_id, record_type, details)
        VALUES (OLD.user_id, OLD.company_id, 'DELETE', 'TMS', OLD.id, 'trip',
                CONCAT('Deleted trip: ', OLD.id));
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Triggers for trip audit logging
DROP TRIGGER IF EXISTS audit_trip_changes ON trips;
CREATE TRIGGER audit_trip_changes
    AFTER INSERT OR UPDATE OR DELETE ON trips
    FOR EACH ROW
    EXECUTE FUNCTION log_trip_changes();

-- Function to log trip order changes
CREATE OR REPLACE FUNCTION log_trip_order_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO tms_audit_logs (user_id, company_id, action, module, record_id, record_type, details)
        VALUES (NEW.user_id, NEW.company_id, 'ASSIGN', 'TMS', NEW.trip_id, 'trip_order',
                CONCAT('Assigned order ', NEW.order_id, ' to trip ', NEW.trip_id));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.sequence_number != NEW.sequence_number THEN
            INSERT INTO tms_audit_logs (user_id, company_id, action, module, record_id, record_type, details)
            VALUES (NEW.user_id, NEW.company_id, 'REORDER', 'TMS', NEW.trip_id, 'trip_order',
                    CONCAT('Changed order sequence for ', NEW.order_id, ' from ', OLD.sequence_number, ' to ', NEW.sequence_number));
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO tms_audit_logs (user_id, company_id, action, module, record_id, record_type, details)
        VALUES (OLD.user_id, OLD.company_id, 'UNASSIGN', 'TMS', OLD.trip_id, 'trip_order',
                CONCAT('Removed order ', OLD.order_id, ' from trip ', OLD.trip_id));
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Triggers for trip order audit logging
DROP TRIGGER IF EXISTS audit_trip_order_changes ON trip_orders;
CREATE TRIGGER audit_trip_order_changes
    AFTER INSERT OR UPDATE OR DELETE ON trip_orders
    FOR EACH ROW
    EXECUTE FUNCTION log_trip_order_changes();

-- Create a view for trip summaries (useful for analytics)
CREATE OR REPLACE VIEW trip_summary AS
SELECT
    t.id,
    t.branch,
    t.truck_plate,
    t.driver_name,
    t.status,
    t.trip_date,
    t.capacity_used,
    t.capacity_total,
    CASE
        WHEN t.capacity_total > 0 THEN ROUND((t.capacity_used::DECIMAL / t.capacity_total) * 100, 2)
        ELSE 0
    END as capacity_percentage,
    COUNT(too.id) as order_count,
    SUM(too.weight) as total_order_weight,
    SUM(too.items) as total_items,
    t.created_at
FROM trips t
LEFT JOIN trip_orders too ON t.id = too.trip_id
GROUP BY t.id, t.branch, t.truck_plate, t.driver_name, t.status,
         t.trip_date, t.capacity_used, t.capacity_total, t.created_at;

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_db_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_db_user;

COMMENT ON TABLE trips IS 'Core table storing trip planning information';
COMMENT ON TABLE trip_orders IS 'Stores order allocations to trips';
COMMENT ON COLUMN trip_orders.sequence_number IS 'Delivery sequence order for drag and drop functionality (0 = first delivery, 1 = second, etc.)';
COMMENT ON TABLE trip_routes IS 'Stores delivery route sequence for trips';
COMMENT ON TABLE tms_audit_logs IS 'Audit trail for all TMS operations';