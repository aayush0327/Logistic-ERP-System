-- Migration: Add marital_status, nationality, passport_number to employee_profiles table
-- Date: 2025-12-27
-- Description: Adds missing fields for employee profile completion

-- Add marital_status column
ALTER TABLE employee_profiles
ADD COLUMN IF NOT EXISTS marital_status VARCHAR(20);

-- Add nationality column
ALTER TABLE employee_profiles
ADD COLUMN IF NOT EXISTS nationality VARCHAR(50) DEFAULT 'India';

-- Add passport_number column
ALTER TABLE employee_profiles
ADD COLUMN IF NOT EXISTS passport_number VARCHAR(20);

-- Add comments
COMMENT ON COLUMN employee_profiles.marital_status IS 'Marital status: single, married, divorced, widowed';
COMMENT ON COLUMN employee_profiles.nationality IS 'Nationality of the employee';
COMMENT ON COLUMN employee_profiles.passport_number IS 'Passport number for international employees';
