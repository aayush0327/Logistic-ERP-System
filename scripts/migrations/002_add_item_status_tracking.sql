-- Migration: Add Item-Level Status Tracking
-- Database: tms_db
-- Tracks individual item lifecycle through a trip

-- =====================================================
-- Step 1: Add item_status column to trip_orders
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'trip_orders'
          AND column_name = 'item_status'
    ) THEN
        ALTER TABLE trip_orders
        ADD COLUMN item_status VARCHAR(50)
        DEFAULT 'pending_to_assign'
        CHECK (
            item_status IN (
                'pending_to_assign',
                'planning',
                'loading',
                'on_route',
                'delivered',
                'failed',
                'returned'
            )
        );

        COMMENT ON COLUMN trip_orders.item_status IS
        'Item-level status: pending_to_assign, planning, loading, on_route, delivered, failed, returned';
    END IF;
END $$;

-- =====================================================
-- Step 2: Backfill item_status from existing trip status
-- =====================================================
DO $$
BEGIN
    -- planning
    UPDATE trip_orders tro
    SET item_status = 'planning'
    WHERE tro.item_status = 'pending_to_assign'
      AND EXISTS (
          SELECT 1 FROM trips t
          WHERE t.id = tro.trip_id
            AND t.status = 'planning'
      );

    -- loading
    UPDATE trip_orders tro
    SET item_status = 'loading'
    WHERE tro.item_status = 'pending_to_assign'
      AND EXISTS (
          SELECT 1 FROM trips t
          WHERE t.id = tro.trip_id
            AND t.status = 'loading'
      );

    -- on route
    UPDATE trip_orders tro
    SET item_status = 'on_route'
    WHERE tro.item_status = 'pending_to_assign'
      AND EXISTS (
          SELECT 1 FROM trips t
          WHERE t.id = tro.trip_id
            AND t.status = 'on-route'
      );

    -- delivered
    UPDATE trip_orders tro
    SET item_status = 'delivered'
    WHERE tro.item_status = 'pending_to_assign'
      AND EXISTS (
          SELECT 1 FROM trips t
          WHERE t.id = tro.trip_id
            AND t.status = 'completed'
      );
END $$;

-- =====================================================
-- Step 3: Trigger function to sync item status with trip
-- =====================================================
CREATE OR REPLACE FUNCTION update_item_status_on_trip_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
        UPDATE trip_orders
        SET item_status = CASE
            WHEN NEW.status = 'planning'  THEN 'planning'
            WHEN NEW.status = 'loading'   THEN 'loading'
            WHEN NEW.status = 'on-route'  THEN 'on_route'
            WHEN NEW.status = 'completed' THEN 'delivered'
            WHEN NEW.status = 'cancelled' THEN 'pending_to_assign'
            ELSE item_status
        END
        WHERE trip_id = NEW.id
          AND item_status NOT IN ('failed', 'returned');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Step 4: Create trigger
-- =====================================================
DROP TRIGGER IF EXISTS trigger_update_item_status_on_trip_change ON trips;

CREATE TRIGGER trigger_update_item_status_on_trip_change
AFTER UPDATE OF status ON trips
FOR EACH ROW
EXECUTE FUNCTION update_item_status_on_trip_status_change();

-- =====================================================
-- Step 5: Indexes
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_trip_orders_item_status
ON trip_orders(item_status);

-- Optional but recommended
CREATE INDEX IF NOT EXISTS idx_trip_orders_trip_id_item_status
ON trip_orders(trip_id, item_status);

-- =====================================================
-- Step 6: Manual update function (single item)
-- =====================================================
CREATE OR REPLACE FUNCTION update_trip_order_item_status(
    p_trip_id   VARCHAR,
    p_order_id  VARCHAR,
    p_new_status VARCHAR
) RETURNS BOOLEAN AS $$
BEGIN
    IF p_new_status NOT IN (
        'pending_to_assign',
        'planning',
        'loading',
        'on_route',
        'delivered',
        'failed',
        'returned'
    ) THEN
        RAISE EXCEPTION 'Invalid item status: %', p_new_status;
    END IF;

    UPDATE trip_orders
    SET item_status = p_new_status
    WHERE trip_id = p_trip_id
      AND order_id = p_order_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Step 7: Bulk update function (entire trip)
-- =====================================================
CREATE OR REPLACE FUNCTION update_all_trip_orders_item_status(
    p_trip_id VARCHAR,
    p_new_status VARCHAR
) RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    IF p_new_status NOT IN (
        'pending_to_assign',
        'planning',
        'loading',
        'on_route',
        'delivered',
        'failed',
        'returned'
    ) THEN
        RAISE EXCEPTION 'Invalid item status: %', p_new_status;
    END IF;

    UPDATE trip_orders
    SET item_status = p_new_status
    WHERE trip_id = p_trip_id;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Step 8: Verification
-- =====================================================
SELECT
    'Migration completed successfully!' AS status,
    item_status,
    COUNT(*) AS count
FROM trip_orders
GROUP BY item_status
ORDER BY item_status;
