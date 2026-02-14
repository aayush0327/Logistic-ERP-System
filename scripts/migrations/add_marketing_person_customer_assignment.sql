-- Create junction table for Marketing Person to Customer assignments
-- Migration: Add marketing person customer assignment feature
-- Date: 2025-01-31
--
-- IMPORTANT: User references are stored as VARCHAR without FK constraints
-- The users table is in the auth database, not the company database.
-- Cross-database foreign keys are not possible in PostgreSQL.

-- Create junction table for Marketing Person to Customer assignments
CREATE TABLE IF NOT EXISTS marketing_person_customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- marketing_person_id: References EmployeeProfile.user_id (no FK - auth database)
    marketing_person_id VARCHAR(255) NOT NULL,
    -- customer_id: FK to customers table (same database)
    customer_id UUID NOT NULL,
    tenant_id VARCHAR(255) NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- assigned_by: User ID from auth service (no FK - cross database)
    assigned_by VARCHAR(255),
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Only FK to local table (customers), NOT to users (auth database)
    CONSTRAINT fk_mpc_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    CONSTRAINT uq_marketing_person_customer UNIQUE (marketing_person_id, customer_id, tenant_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_mpc_marketing_person ON marketing_person_customers(marketing_person_id);
CREATE INDEX IF NOT EXISTS idx_mpc_customer ON marketing_person_customers(customer_id);
CREATE INDEX IF NOT EXISTS idx_mpc_tenant ON marketing_person_customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mpc_is_active ON marketing_person_customers(is_active);

-- Add comments
COMMENT ON TABLE marketing_person_customers IS 'Junction table for assigning customers to marketing persons';
COMMENT ON COLUMN marketing_person_customers.marketing_person_id IS 'User ID from EmployeeProfile (references auth service users table via user_id)';
COMMENT ON COLUMN marketing_person_customers.customer_id IS 'Customer ID being assigned';
COMMENT ON COLUMN marketing_person_customers.tenant_id IS 'Tenant ID for multi-tenancy';
COMMENT ON COLUMN marketing_person_customers.assigned_by IS 'User ID who made the assignment (from auth service)';
COMMENT ON COLUMN marketing_person_customers.notes IS 'Optional notes about the assignment';
COMMENT ON COLUMN marketing_person_customers.is_active IS 'Whether the assignment is active (soft delete)';

-- Create trigger to update updated_at
CREATE TRIGGER update_marketing_person_customers_updated_at
    BEFORE UPDATE ON marketing_person_customers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
