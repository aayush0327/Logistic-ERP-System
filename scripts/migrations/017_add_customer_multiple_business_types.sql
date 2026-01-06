    -- Migration 017: Add Multiple Business Types Support for Customers
    -- This migration adds support for customers to have multiple business types
    -- Creates a junction table for many-to-many relationship between customers and business_types

    -- ================================================================================
    -- STEP 1: Create junction table for customer-business type relationships
    -- ================================================================================

    CREATE TABLE IF NOT EXISTS customer_business_types (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id UUID NOT NULL,
        business_type_id UUID NOT NULL REFERENCES business_types(id) ON DELETE CASCADE,
        tenant_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_by VARCHAR(255)
    );

    -- Add unique constraint if it doesn't exist (handle case where table was created without it)
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'customer_business_types_customer_id_business_type_id_key'
        ) THEN
            ALTER TABLE customer_business_types
            ADD CONSTRAINT customer_business_types_customer_id_business_type_id_key
            UNIQUE (customer_id, business_type_id);
        END IF;
    END $$;

    -- Add comment
    COMMENT ON TABLE customer_business_types IS 'Junction table for many-to-many relationship between customers and business types';
    COMMENT ON COLUMN customer_business_types.customer_id IS 'Reference to customers table';
    COMMENT ON COLUMN customer_business_types.business_type_id IS 'Reference to business_types table';
    COMMENT ON COLUMN customer_business_types.tenant_id IS 'Tenant ID for multi-tenancy';

    -- ================================================================================
    -- STEP 2: Create indexes for performance
    -- ================================================================================

    CREATE INDEX IF NOT EXISTS idx_customer_business_types_customer_id ON customer_business_types(customer_id);
    CREATE INDEX IF NOT EXISTS idx_customer_business_types_business_type_id ON customer_business_types(business_type_id);
    CREATE INDEX IF NOT EXISTS idx_customer_business_types_tenant_id ON customer_business_types(tenant_id);

    -- ================================================================================
    -- STEP 3: Migrate existing data from business_type_id to junction table
    -- ================================================================================

    -- Migrate existing customers with business_type_id to the junction table
    INSERT INTO customer_business_types (customer_id, business_type_id, tenant_id)
    SELECT
        c.id as customer_id,
        c.business_type_id,
        c.tenant_id
    FROM customers c
    WHERE c.business_type_id IS NOT NULL
    ON CONFLICT (customer_id, business_type_id) DO NOTHING;

    -- ================================================================================
    -- STEP 4: Enable Row Level Security
    -- ================================================================================

    ALTER TABLE customer_business_types ENABLE ROW LEVEL SECURITY;

    -- ================================================================================
    -- VERIFICATION
    -- ================================================================================

    -- Verify the table was created
    SELECT
        table_name,
        column_name,
        data_type,
        is_nullable
    FROM information_schema.columns
    WHERE table_name = 'customer_business_types'
    ORDER BY ordinal_position;

    -- Verify indexes were created
    SELECT
        indexname,
        indexdef
    FROM pg_indexes
    WHERE tablename = 'customer_business_types';

    -- Verify data migration (count migrated relationships)
    SELECT COUNT(*) as migrated_relationships
    FROM customer_business_types;

    -- Verify customers with their business types
    SELECT
        c.code as customer_code,
        c.name as customer_name,
        json_agg(
            json_build_object(
                'id', bt.id,
                'name', bt.name,
                'code', bt.code
            )
        ) as business_types
    FROM customers c
    LEFT JOIN customer_business_types cbt ON c.id = cbt.customer_id
    LEFT JOIN business_types bt ON cbt.business_type_id = bt.id
    GROUP BY c.id, c.code, c.name
    ORDER BY c.code;
