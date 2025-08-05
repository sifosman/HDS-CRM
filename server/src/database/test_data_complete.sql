-- Comprehensive test data script for PayFast integration testing
-- This script creates both a test cutlist and a test quote with all required fields

-- Step 1: Check if there are any existing cutlists we can use
-- SELECT id FROM cutlists LIMIT 5;

-- Step 2: Option A - Create a test cutlist (if you don't have any existing ones)
-- This creates a minimal cutlist that satisfies the foreign key constraint
INSERT INTO cutlists (id, unit) 
VALUES ('test-cutlist-001', 'mm')
ON CONFLICT (id) DO NOTHING; -- Prevents error if it already exists

-- Step 3: Option A - Create a complete test quote referencing the test cutlist
INSERT INTO quotes (
  filename, 
  cutlist_id, 
  quote_number,
  customer_name,
  customer_phone,
  customer_email,
  project_name,
  quote_data,
  subtotal,
  tax,
  total,
  status,
  cutlist_url,
  expiry_date
) VALUES (
  'test-quote.pdf',
  'test-cutlist-001', -- References the cutlist we just created
  'Q-20250805-0001-HDSPRO',
  'Test Customer',
  '+27123456789',
  'test@example.com',
  'Test Project',
  '{"items": [{"description": "Test Item 1", "quantity": 2, "unitPrice": 500.00, "total": 1000.00}, {"description": "Test Item 2", "quantity": 1, "unitPrice": 200.00, "total": 200.00}], "totals": {"subtotal": 1200.00, "tax": 180.00, "finalTotal": 1380.00}}'::jsonb,
  1200.00,
  180.00,
  1380.00,
  'approved',
  'https://example.com/cutlist.pdf',
  NOW() + INTERVAL '30 days'
)
ON CONFLICT DO NOTHING; -- Prevents error if quote already exists

-- Step 4: Option B - If you have an existing cutlist, update an existing quote
-- First, find an existing quote and its cutlist_id:
-- SELECT id, cutlist_id FROM quotes LIMIT 1;

-- Then update the quote (replace 'existing-quote-id' with actual quote ID):
-- UPDATE quotes SET 
--   quote_number = 'Q-20250805-0001-HDSPRO',
--   customer_name = 'Test Customer',
--   customer_phone = '+27123456789',
--   customer_email = 'test@example.com',
--   project_name = 'Test Project',
--   quote_data = '{"items": [{"description": "Test Item 1", "quantity": 2, "unitPrice": 500.00, "total": 1000.00}, {"description": "Test Item 2", "quantity": 1, "unitPrice": 200.00, "total": 200.00}], "totals": {"subtotal": 1200.00, "tax": 180.00, "finalTotal": 1380.00}}'::jsonb,
--   subtotal = 1200.00,
--   tax = 180.00,
--   total = 1380.00,
--   status = 'approved',
--   cutlist_url = 'https://example.com/cutlist.pdf',
--   expiry_date = NOW() + INTERVAL '30 days'
-- WHERE id = 'existing-quote-id'; -- Replace with actual quote ID

-- Step 5: Verify the data was inserted/updated correctly
SELECT 
  q.id, 
  q.quote_number,
  q.customer_name,
  q.customer_phone,
  q.customer_email,
  q.project_name,
  q.subtotal,
  q.tax,
  q.total,
  q.status,
  q.cutlist_id,
  q.created_at,
  c.id as cutlist_exists
FROM quotes q
LEFT JOIN cutlists c ON q.cutlist_id = c.id
WHERE q.quote_number = 'Q-20250805-0001-HDSPRO';

-- Step 6: Check all recent quotes to see what data is available
SELECT * FROM quotes ORDER BY created_at DESC LIMIT 5;
