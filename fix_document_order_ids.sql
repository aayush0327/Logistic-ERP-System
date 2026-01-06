-- Fix incorrect order_id values in order_documents table
-- This script updates documents that were stored with wrong order_id UUIDs

-- Step 1: First, let's see what we have
SELECT
    od.id as document_id,
    od.order_id as current_order_id,,
    o.id as correct_order_id,
    o.order_number,
    od.file_path,
    od.file_name
FROM order_documents od
LEFT JOIN orders o ON od.file_path LIKE '%' || o.order_number || '%'
WHERE od.order_id != o.id
   OR o.id IS NULL;

-- Step 2: Update documents to use correct order_id based on order_number in file_path
-- This matches the order by extracting order_number from the file_path
UPDATE order_documents od
SET order_id = (
    SELECT o.id
    FROM orders o
    WHERE od.file_path LIKE '%orders/' || o.order_number || '%'
    LIMIT 1
)
WHERE od.id IN (
    -- List of document IDs that need fixing
    '74c7e0aa-ad67-4ceb-8334-40f12b72bb4f',
    '936c2471-1235-4fdc-9166-d1b29780af25',
    -- Add more document IDs as needed
);

-- Step 3: Verify the fix
SELECT
    od.id as document_id,
    od.order_id as order_id,
    o.order_number,
    od.file_name,
    od.file_path,
    o.id as verified_order_id
FROM order_documents od
JOIN orders o ON od.order_id = o.id
WHERE od.id IN ('74c7e0aa-ad67-4ceb-8334-40f12b72bb4f', '936c2471-1235-4fdc-9166-d1b29780af25');

-- Alternative: If you want to fix ALL documents at once based on file_path pattern
UPDATE order_documents od
SET order_id = (
    SELECT o.id
    FROM orders o
    -- Match order_number in path like "orders/ORD-20260106-809B2C67/"
    WHERE od.file_path ~ 'orders/' || o.order_number || '/'
    LIMIT 1
)
WHERE EXISTS (
    -- Only update where we can find a matching order
    SELECT 1 FROM orders o
    WHERE od.file_path ~ 'orders/' || o.order_number || '/'
    AND od.order_id != o.id
);
