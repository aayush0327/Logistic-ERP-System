-- Migration 018: Add marketing person fields to customers table
-- Description: Adds contact details for the marketing person assigned to each customer

-- Add marketing person columns to customers table
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS marketing_person_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS marketing_person_phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS marketing_person_email VARCHAR(100);

-- Add comments for documentation
COMMENT ON COLUMN customers.marketing_person_name IS 'Name of the marketing person assigned to this customer';
COMMENT ON COLUMN customers.marketing_person_phone IS 'Phone number of the marketing person';
COMMENT ON COLUMN customers.marketing_person_email IS 'Email address of the marketing person';

COMMIT;
