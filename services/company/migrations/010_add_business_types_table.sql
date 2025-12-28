-- Migration: Add business_types table for dynamic business type management
-- This allows users to create custom business types instead of using hardcoded enum

-- Create business_types table
CREATE TABLE IF NOT EXISTS business_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    description VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, code)
);

-- Create index on tenant_id for faster queries
CREATE INDEX IF NOT EXISTS idx_business_types_tenant_id ON business_types(tenant_id);

-- Create index on is_active for filtering
CREATE INDEX IF NOT EXISTS idx_business_types_is_active ON business_types(is_active);

-- Insert default business types for existing tenants
-- These correspond to the old enum values: individual, small_business, corporate, government
INSERT INTO business_types (tenant_id, name, code, description, is_active)
SELECT DISTINCT tenant_id, 'Individual', 'individual', 'Individual customer or personal account', TRUE
FROM customers
ON CONFLICT (tenant_id, code) DO NOTHING;

INSERT INTO business_types (tenant_id, name, code, description, is_active)
SELECT DISTINCT tenant_id, 'Small Business', 'small_business', 'Small to medium business enterprise', TRUE
FROM customers
ON CONFLICT (tenant_id, code) DO NOTHING;

INSERT INTO business_types (tenant_id, name, code, description, is_active)
SELECT DISTINCT tenant_id, 'Corporate', 'corporate', 'Large corporation or enterprise', TRUE
FROM customers
ON CONFLICT (tenant_id, code) DO NOTHING;

INSERT INTO business_types (tenant_id, name, code, description, is_active)
SELECT DISTINCT tenant_id, 'Government', 'government', 'Government entity or department', TRUE
FROM customers
ON CONFLICT (tenant_id, code) DO NOTHING;

-- Add new column to customers table to reference business_types
ALTER TABLE customers ADD COLUMN IF NOT EXISTS business_type_id UUID REFERENCES business_types(id) ON DELETE SET NULL;

-- Migrate existing business_type enum values to business_type_id
-- Cast business_type enum to text for comparison
UPDATE customers
SET business_type_id = (
    SELECT bt.id
    FROM business_types bt
    WHERE bt.tenant_id = customers.tenant_id
    AND bt.code = (customers.business_type::text)
    LIMIT 1
)
WHERE business_type IS NOT NULL;

-- Note: We're keeping the old business_type column for now to allow rollback
-- After verification, the old column can be dropped with:
-- ALTER TABLE customers DROP COLUMN business_type;
-- ALTER TABLE customers DROP CONSTRAINT customers_business_type_check;
