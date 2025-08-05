-- Script to insert complete test quote data for testing PayFast integration
-- This version works with the updated quotes table schema

-- First, let's find an existing cutlist ID to use
-- SELECT id FROM cutlists LIMIT 1;

-- Check if there are any existing quotes that we can update
-- SELECT id, cutlist_id FROM quotes LIMIT 5;

-- For testing purposes, let's update an existing quote with complete data
-- Replace 'existing-quote-id' with an actual quote ID from your database
-- You can find an existing quote ID with: SELECT id FROM quotes LIMIT 1;
-- Make sure to keep the existing cutlist_id value

UPDATE quotes SET 
  quote_number = 'Q-20250805-0001-HDSPRO',
  customer_name = 'Test Customer',
  customer_phone = '+27123456789',
  customer_email = 'test@example.com',
  project_name = 'Test Project',
  quote_data = '{"items": [{"description": "Test Item 1", "quantity": 2, "unitPrice": 500.00, "total": 1000.00}, {"description": "Test Item 2", "quantity": 1, "unitPrice": 200.00, "total": 200.00}], "totals": {"subtotal": 1200.00, "tax": 180.00, "finalTotal": 1380.00}}'::jsonb,
  subtotal = 1200.00,
  tax = 180.00,
  total = 1380.00,
  status = 'approved',
  cutlist_url = 'https://example.com/cutlist.pdf',
  expiry_date = NOW() + INTERVAL '30 days'
WHERE id = 'existing-quote-id'; -- Replace with actual quote ID

-- If you don't have any existing quotes, you'll need to first create a cutlist
-- and then create a quote with all required fields

-- First create a test cutlist (if needed)
-- INSERT INTO cutlists (id, name, data) VALUES ('test-cutlist-001', 'Test Cutlist', '{}');

-- Then create a complete quote with ALL required fields including cutlist_id
-- Replace 'existing-cutlist-id' with an actual cutlist ID from your database
-- INSERT INTO quotes (
--   filename, 
--   cutlist_id, 
--   quote_number,
--   customer_name,
--   customer_phone,
--   customer_email,
--   project_name,
--   quote_data,
--   subtotal,
--   tax,
--   total,
--   status,
--   cutlist_url,
--   expiry_date
-- ) VALUES (
--   'test-quote.pdf',
--   'existing-cutlist-id', -- This is REQUIRED and must reference an existing cutlist
--   'Q-20250805-0001-HDSPRO',
--   'Test Customer',
--   '+27123456789',
--   'test@example.com',
--   'Test Project',
--   '{"items": [{"description": "Test Item 1", "quantity": 2, "unitPrice": 500.00, "total": 1000.00}, {"description": "Test Item 2", "quantity": 1, "unitPrice": 200.00, "total": 200.00}], "totals": {"subtotal": 1200.00, "tax": 180.00, "finalTotal": 1380.00}}'::jsonb,
--   1200.00,
--   180.00,
--   1380.00,
--   'approved',
--   'https://example.com/cutlist.pdf',
--   NOW() + INTERVAL '30 days'
-- );

-- Verify the data was updated/inserted correctly
SELECT 
  id, 
  quote_number,
  customer_name,
  customer_phone,
  customer_email,
  project_name,
  subtotal,
  tax,
  total,
  status,
  cutlist_id,
  created_at
FROM quotes 
WHERE quote_number = 'Q-20250805-0001-HDSPRO';

-- Check all quotes to see what data is available
SELECT * FROM quotes ORDER BY created_at DESC LIMIT 5;
