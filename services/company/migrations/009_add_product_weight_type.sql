-- Migration: Add weight type fields to products table
-- Description: Adds support for fixed and variable weight products
-- Date: 2025-12-27

-- Drop old columns if they exist from previous migration
ALTER TABLE products
    DROP COLUMN IF EXISTS variable_weight_min,
    DROP COLUMN IF EXISTS variable_weight_max;

-- Drop existing weight_type column if it exists as VARCHAR to recreate as ENUM
DO $$
BEGIN
    -- Check if weight_type column exists and is not an enum
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'products'
        AND column_name = 'weight_type'
        AND data_type = 'character varying'
    ) THEN
        ALTER TABLE products DROP COLUMN weight_type;
    END IF;
END $$;

-- Add weight_type enum type
DO $$ BEGIN
    CREATE TYPE weight_type AS ENUM ('fixed', 'variable');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add new columns to products table
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS weight_type weight_type DEFAULT 'fixed',
    ADD COLUMN IF NOT EXISTS fixed_weight FLOAT,
    ADD COLUMN IF NOT EXISTS weight_unit VARCHAR(20) DEFAULT 'kg';

-- Add comments for documentation
COMMENT ON COLUMN products.weight_type IS 'Type of weight: fixed (pre-determined) or variable (entered when creating order)';
COMMENT ON COLUMN products.fixed_weight IS 'Standard weight for FIXED weight type products';
COMMENT ON COLUMN products.weight_unit IS 'Weight unit (kg, lb, g, etc.)';

-- Migrate existing products to use fixed weight type
UPDATE products
SET weight_type = 'fixed',
    fixed_weight = weight,
    weight_unit = 'kg'
WHERE weight_type IS NULL OR weight_type = '';
