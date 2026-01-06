-- Migration 016: Fix Unique Constraints for Multi-Tenancy
-- This migration fixes unique constraints to be tenant-aware
-- Instead of global uniqueness, constraints now ensure uniqueness within each tenant
-- Run this AFTER ensuring existing data has no conflicts

-- ================================================================================
-- IMPORTANT: Run data conflict checks BEFORE applying this migration
-- ================================================================================

-- Check for existing conflicts BEFORE dropping constraints
-- These queries will show any duplicate codes/numbers across different tenants

-- Check branches for duplicate codes across tenants
SELECT tenant_id, code, COUNT(*) as count
FROM branches
GROUP BY tenant_id, code
HAVING COUNT(*) > 1;

-- Check customers for duplicate codes across tenants
SELECT tenant_id, code, COUNT(*) as count
FROM customers
GROUP BY tenant_id, code
HAVING COUNT(*) > 1;

-- Check vehicles for duplicate plate numbers across tenants
SELECT tenant_id, plate_number, COUNT(*) as count
FROM vehicles
GROUP BY tenant_id, plate_number
HAVING COUNT(*) > 1;

-- Check products for duplicate codes across tenants
SELECT tenant_id, code, COUNT(*) as count
FROM products
GROUP BY tenant_id, code
HAVING COUNT(*) > 1;

-- Check service_zones for duplicate codes across tenants
SELECT tenant_id, code, COUNT(*) as count
FROM service_zones
GROUP BY tenant_id, code
HAVING COUNT(*) > 1;

-- Check employee_profiles for duplicate employee_codes across tenants
SELECT tenant_id, employee_code, COUNT(*) as count
FROM employee_profiles
WHERE employee_code IS NOT NULL
GROUP BY tenant_id, employee_code
HAVING COUNT(*) > 1;

-- Check driver_profiles for duplicate license_numbers across tenants
SELECT tenant_id, license_number, COUNT(*) as count
FROM driver_profiles
GROUP BY tenant_id, license_number
HAVING COUNT(*) > 1;

-- ================================================================================
-- STEP 1: Drop old single-column unique constraints
-- ================================================================================

-- Drop branches constraint
ALTER TABLE branches DROP CONSTRAINT IF EXISTS branches_code_key;

-- Drop customers constraint
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_code_key;

-- Drop vehicles constraint
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_plate_number_key;

-- Drop products constraint
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_code_key;

-- Drop service_zones constraint
ALTER TABLE service_zones DROP CONSTRAINT IF EXISTS service_zones_code_key;

-- Drop employee_profiles employee_code constraint
ALTER TABLE employee_profiles DROP CONSTRAINT IF EXISTS employee_profiles_employee_code_key;

-- Drop driver_profiles license_number constraint
ALTER TABLE driver_profiles DROP CONSTRAINT IF EXISTS driver_profiles_license_number_key;

-- ================================================================================
-- STEP 2: Add new tenant-aware unique constraints
-- ================================================================================

-- Add tenant-aware unique constraint for branches (tenant_id, code)
ALTER TABLE branches
ADD CONSTRAINT branches_tenant_code_key UNIQUE (tenant_id, code);

-- Add tenant-aware unique constraint for customers (tenant_id, code)
ALTER TABLE customers
ADD CONSTRAINT customers_tenant_code_key UNIQUE (tenant_id, code);

-- Add tenant-aware unique constraint for vehicles (tenant_id, plate_number)
ALTER TABLE vehicles
ADD CONSTRAINT vehicles_tenant_plate_key UNIQUE (tenant_id, plate_number);

-- Add tenant-aware unique constraint for products (tenant_id, code)
ALTER TABLE products
ADD CONSTRAINT products_tenant_code_key UNIQUE (tenant_id, code);

-- Add tenant-aware unique constraint for service_zones (tenant_id, code)
ALTER TABLE service_zones
ADD CONSTRAINT service_zones_tenant_code_key UNIQUE (tenant_id, code);

-- Add tenant-aware unique constraint for employee_profiles (tenant_id, employee_code)
ALTER TABLE employee_profiles
ADD CONSTRAINT employee_profiles_tenant_code_key UNIQUE (tenant_id, employee_code);

-- Add tenant-aware unique constraint for driver_profiles (tenant_id, license_number)
ALTER TABLE driver_profiles
ADD CONSTRAINT driver_profiles_tenant_license_key UNIQUE (tenant_id, license_number);

-- Add tenant-aware unique constraint for user_invitations (tenant_id, email)
-- This allows the same email to be invited by different tenants
ALTER TABLE user_invitations
ADD CONSTRAINT user_invitations_tenant_email_key UNIQUE (tenant_id, email);

-- ================================================================================
-- STEP 3: Create helper function to generate tenant-scoped unique codes
-- ================================================================================

-- Function to generate next sequential code for a tenant
CREATE OR REPLACE FUNCTION generate_tenant_code(
    p_table_name TEXT,
    p_tenant_id VARCHAR(255),
    p_prefix TEXT DEFAULT NULL
) RETURNS VARCHAR(20) AS $$
DECLARE
    v_max_code VARCHAR(20);
    v_next_number INTEGER;
    v_new_code VARCHAR(20);
BEGIN
    -- Get the maximum numeric code for this tenant
    EXECUTE format('
        SELECT MAX(code)
        FROM %I
        WHERE tenant_id = $1
        AND code ~ %L
    ', p_table_name, p_prefix || '\d+$')
    INTO v_max_code
    USING p_tenant_id, p_prefix || '%';

    -- Extract the number and increment
    IF v_max_code IS NOT NULL THEN
        v_next_number := CAST(regexp_replace(v_max_code, '\D*', '', 'g') AS INTEGER) + 1;
    ELSE
        v_next_number := 1;
    END IF;

    -- Format with leading zeros (4 digits)
    v_new_code := p_prefix || LPAD(v_next_number::TEXT, 4, '0');

    RETURN v_new_code;
END;
$$ LANGUAGE plpgsql;

-- ================================================================================
-- STEP 4: Add comments for documentation
-- ================================================================================

COMMENT ON CONSTRAINT branches_tenant_code_key ON branches IS
    'Ensures branch codes are unique within each tenant (company)';

COMMENT ON CONSTRAINT customers_tenant_code_key ON customers IS
    'Ensures customer codes are unique within each tenant (company)';

COMMENT ON CONSTRAINT vehicles_tenant_plate_key ON vehicles IS
    'Ensures vehicle plate numbers are unique within each tenant (company)';

COMMENT ON CONSTRAINT products_tenant_code_key ON products IS
    'Ensures product codes are unique within each tenant (company)';

COMMENT ON CONSTRAINT service_zones_tenant_code_key ON service_zones IS
    'Ensures service zone codes are unique within each tenant (company)';

COMMENT ON CONSTRAINT employee_profiles_tenant_code_key ON employee_profiles IS
    'Ensures employee codes are unique within each tenant (company)';

COMMENT ON CONSTRAINT driver_profiles_tenant_license_key ON driver_profiles IS
    'Ensures driver license numbers are unique within each tenant (company)';

COMMENT ON CONSTRAINT user_invitations_tenant_email_key ON user_invitations IS
    'Ensures invitation emails are unique within each tenant (allows same email across tenants)';

COMMENT ON FUNCTION generate_tenant_code IS
    'Generates the next sequential code for a tenant within a table. Usage: generate_tenant_code(''branches'', ''tenant-uuid'', ''BRN'') returns ''BRN0001''';

-- ================================================================================
-- VERIFICATION QUERIES
-- ================================================================================

-- Verify the new constraints are in place
SELECT
    conname AS constraint_name,
    conrelid::regclass AS table_name,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
AND conname LIKE '%_tenant_%_key'
ORDER BY conrelid::regclass::text, conname;

-- Expected output should show:
-- branches_tenant_code_key UNIQUE (tenant_id, code)
-- customers_tenant_code_key UNIQUE (tenant_id, code)
-- vehicles_tenant_plate_key UNIQUE (tenant_id, plate_number)
-- products_tenant_code_key UNIQUE (tenant_id, code)
-- service_zones_tenant_code_key UNIQUE (tenant_id, code)
-- employee_profiles_tenant_code_key UNIQUE (tenant_id, employee_code)
-- driver_profiles_tenant_license_key UNIQUE (tenant_id, license_number)
-- user_invitations_tenant_email_key UNIQUE (tenant_id, email)
