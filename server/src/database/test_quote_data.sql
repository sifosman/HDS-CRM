-- Script to insert test quote data for testing PayFast integration
-- This will help verify that the invoice download functionality works correctly

-- Insert a test quote with a human-readable quote number
INSERT INTO quotes (id, filename, created_at, cutlist_id, quote_number, customer_name, project_name, total_amount, status)
VALUES (
  gen_random_uuid(), -- Generate a random UUID for the id column
  'test-quote.pdf',
  NOW(),
  'test-cutlist-001',
  'Q-20250805-0001-HDSPRO', -- Human-readable quote number with branch abbreviation
  'Test Customer',
  'Test Project',
  2527.09,
  'approved'
);

-- Verify the data was inserted correctly
SELECT id, quote_number, customer_name, project_name, total_amount, status 
FROM quotes 
WHERE quote_number = 'Q-20250805-0001-HDSPRO';

-- You can also check all quotes to see the data
SELECT * FROM quotes ORDER BY created_at DESC LIMIT 5;
