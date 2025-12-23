-- Enable Row Level Security Policies for Company Service
-- This script enables tenant isolation at the database level

-- First, let's create a function to extract tenant_id from JWT token
-- This assumes the tenant_id is passed as a session variable after JWT validation

CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS TEXT AS $$
DECLARE
    tenant_id TEXT;
BEGIN
    -- Get tenant_id from session variable (set by middleware after JWT validation)
    tenant_id := current_setting('app.current_tenant_id', true);

    -- If no tenant_id in session, raise an exception
    IF tenant_id IS NULL THEN
        RAISE EXCEPTION 'No tenant_id found in session context';
    END IF;

    RETURN tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check if user has specific permission
CREATE OR REPLACE FUNCTION has_permission(permission_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    user_permissions TEXT[];
    required_permission TEXT;
BEGIN
    -- Get permissions from session variable (set by middleware after JWT validation)
    user_permissions := string_to_array(current_setting('app.user_permissions', true), ',');

    -- Check if the required permission is in the user's permissions
    RETURN permission_name = ANY(user_permissions);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function for Super Admin check (can access all data)
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN has_permission('superuser:access');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable Row Level Security on all tables (if not already enabled)
DO $$
BEGIN
    -- Check if RLS is already enabled, and enable it if not
    IF NOT EXISTS (
        SELECT 1 FROM pg_tables
        WHERE tablename = 'branches' AND rowsecurity = true
    ) THEN
        ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_tables
        WHERE tablename = 'customers' AND rowsecurity = true
    ) THEN
        ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_tables
        WHERE tablename = 'vehicles' AND rowsecurity = true
    ) THEN
        ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_tables
        WHERE tablename = 'products' AND rowsecurity = true
    ) THEN
        ALTER TABLE products ENABLE ROW LEVEL SECURITY;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_tables
        WHERE tablename = 'product_categories' AND rowsecurity = true
    ) THEN
        ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_tables
        WHERE tablename = 'pricing_rules' AND rowsecurity = true
    ) THEN
        ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_tables
        WHERE tablename = 'service_zones' AND rowsecurity = true
    ) THEN
        ALTER TABLE service_zones ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS branch_tenant_policy ON branches;
DROP POLICY IF EXISTS customer_tenant_policy ON customers;
DROP POLICY IF EXISTS vehicle_tenant_policy ON vehicles;
DROP POLICY IF EXISTS product_tenant_policy ON products;
DROP POLICY IF EXISTS product_category_tenant_policy ON product_categories;
DROP POLICY IF EXISTS pricing_tenant_policy ON pricing_rules;
DROP POLICY IF EXISTS zone_tenant_policy ON service_zones;

-- Create RLS Policies for each table
-- Branches Table Policies
CREATE POLICY branch_tenant_isolation ON branches
    FOR ALL
    TO company_service_role
    USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- Customers Table Policies
CREATE POLICY customer_tenant_isolation ON customers
    FOR ALL
    TO company_service_role
    USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- Vehicles Table Policies
CREATE POLICY vehicle_tenant_isolation ON vehicles
    FOR ALL
    TO company_service_role
    USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- Products Table Policies
CREATE POLICY product_tenant_isolation ON products
    FOR ALL
    TO company_service_role
    USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- Product Categories Table Policies
CREATE POLICY product_category_tenant_isolation ON product_categories
    FOR ALL
    TO company_service_role
    USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- Pricing Rules Table Policies
CREATE POLICY pricing_tenant_isolation ON pricing_rules
    FOR ALL
    TO company_service_role
    USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- Service Zones Table Policies
CREATE POLICY service_zone_tenant_isolation ON service_zones
    FOR ALL
    TO company_service_role
    USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- Create specific policies for different permission levels
-- For example, users with branches:read_own can only see branches they manage

-- Branch Management Policies
CREATE POLICY branch_management_own ON branches
    FOR SELECT
    TO company_service_role
    USING (
        is_super_admin() OR
        tenant_id = get_current_tenant_id() OR
        (has_permission('branches:read_own') AND manager_id = current_setting('app.user_id'))
    );

CREATE POLICY branch_management_all ON branches
    FOR ALL
    TO company_service_role
    USING (
        is_super_admin() OR
        (has_permission('branches:manage_all') AND tenant_id = get_current_tenant_id())
    );

-- Customer Access Policies
CREATE POLICY customer_own_access ON customers
    FOR SELECT
    TO company_service_role
    USING (
        is_super_admin() OR
        tenant_id = get_current_tenant_id() OR
        (has_permission('customers:read_own') AND home_branch_id IN (
            SELECT id FROM branches
            WHERE manager_id = current_setting('app.user_id')
            AND tenant_id = get_current_tenant_id()
        ))
    );

-- Vehicle Assignment Policies
CREATE POLICY vehicle_assignment ON vehicles
    FOR UPDATE
    TO company_service_role
    USING (
        is_super_admin() OR
        (has_permission('vehicles:assign') AND tenant_id = get_current_tenant_id())
    );

-- Product Stock Adjustment Policies
CREATE POLICY product_stock_adjustment ON products
    FOR UPDATE
    TO company_service_role
    USING (
        is_super_admin() OR
        (has_permission('products:stock_adjust') AND tenant_id = get_current_tenant_id())
    );

-- Grant usage of these functions to the service role
GRANT EXECUTE ON FUNCTION get_current_tenant_id() TO company_service_role;
GRANT EXECUTE ON FUNCTION has_permission(TEXT) TO company_service_role;
GRANT EXECUTE ON FUNCTION is_super_admin() TO company_service_role;

-- Create a function to set session variables from JWT token
-- This will be called by the middleware after successful JWT validation
CREATE OR REPLACE FUNCTION set_auth_context(tenant_id TEXT, user_id TEXT, user_permissions TEXT[])
RETURNS VOID AS $$
BEGIN
    -- Set session variables for RLS policies
    PERFORM set_config('app.current_tenant_id', tenant_id, true);
    PERFORM set_config('app.user_id', user_id, true);
    PERFORM set_config('app.user_permissions', array_to_string(user_permissions, ','), true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION set_auth_context(TEXT, TEXT, TEXT[]) TO company_service_role;

-- Create an index on tenant_id for all tables to improve RLS performance
CREATE INDEX IF NOT EXISTS idx_branches_tenant_rls ON branches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_rls ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_tenant_rls ON vehicles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant_rls ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_tenant_rls ON product_categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pricing_rules_tenant_rls ON pricing_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_service_zones_tenant_rls ON service_zones(tenant_id);

-- Create audit trigger for security events
CREATE OR REPLACE FUNCTION audit_tenant_access()
RETURNS TRIGGER AS $$
BEGIN
    -- Log access attempts (this could be enhanced to log to a separate audit table)
    IF TG_OP = 'SELECT' THEN
        -- Optionally log read access for sensitive data
        RETURN NEW;
    ELSIF TG_OP IN ('INSERT', 'UPDATE', 'DELETE') then
        -- Log write operations
        INSERT INTO audit_logs (table_name, operation, tenant_id, user_id, timestamp)
        VALUES (
            TG_TABLE_NAME,
            TG_OP,
            current_setting('app.current_tenant_id', true),
            current_setting('app.user_id', true),
            CURRENT_TIMESTAMP
        );
        RETURN COALESCE(NEW, OLD);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create audit_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    operation VARCHAR(10) NOT NULL,
    tenant_id VARCHAR(255),
    user_id VARCHAR(255),
    old_values JSONB,
    new_values JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS on audit_logs as well
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for audit logs (super admins can see all, others see only their tenant)
CREATE POLICY audit_logs_tenant_isolation ON audit_logs
    FOR ALL
    TO company_service_role
    USING (is_super_admin() OR tenant_id = get_current_tenant_id());

-- Create indexes for audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_operation ON audit_logs(operation);

-- Success notification
DO $$
BEGIN
    RAISE NOTICE 'Row Level Security (RLS) policies have been successfully enabled for company service';
    RAISE NOTICE 'Tenant isolation is now active at the database level';
    RAISE NOTICE 'Make sure to set session variables using set_auth_context() after JWT validation';
END $$;