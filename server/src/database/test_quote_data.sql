-- Script to insert test quote data for testing PayFast integration
-- This will help verify that the invoice download functionality works correctly

-- First, check if there are any existing cutlists we can use
-- SELECT id FROM cutlists LIMIT 1;

-- If you have an existing cutlist, replace 'existing-cutlist-id' with an actual cutlist ID from your database
-- You can find an existing cutlist ID with: SELECT id FROM cutlists LIMIT 1;

INSERT INTO quotes (filename, cutlist_id, quote_number, customer_name, customer_phone, project_name, total, status)
VALUES (
  'test-quote.pdf',
  'existing-cutlist-id', -- Replace with actual cutlist ID
  'Q-20250805-0001-HDSPRO', -- Human-readable quote number with branch abbreviation
  'Test Customer',
  '+27123456789',
  'Test Project',
  2527.09,
  'approved'
)
ON CONFLICT DO NOTHING; -- Prevents error if quote already exists

-- Verify the data was inserted correctly
SELECT id, quote_number, customer_name, project_name, total, status, cutlist_id
FROM quotes 
WHERE quote_number = 'Q-20250805-0001-HDSPRO';

-- You can also check all quotes to see the data
SELECT * FROM quotes ORDER BY created_at DESC LIMIT 5;
