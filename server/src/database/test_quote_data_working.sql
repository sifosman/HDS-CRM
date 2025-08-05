-- Script to insert test quote data for testing PayFast integration
-- This version works with the actual current quotes table schema

-- First, check if we have a cutlist to reference
-- SELECT id FROM cutlists LIMIT 1;

-- For testing purposes, we'll need to add the quote_number to an existing quote
-- or create a minimal quote with just the required fields

-- Option 1: Update an existing quote to add a quote_number
-- Replace 'existing-quote-id' with an actual quote ID from your database
UPDATE quotes 
SET quote_number = 'Q-20250805-0001-HDSPRO' 
WHERE id = 'existing-quote-id'; -- Replace with actual quote ID

-- Option 2: If you don't have any quotes, you'll need to first create a cutlist
-- and then create a quote with the minimal required fields

-- First create a test cutlist (if needed)
-- INSERT INTO cutlists (id, name, data) VALUES ('test-cutlist-001', 'Test Cutlist', '{}');

-- Then create a minimal quote
-- INSERT INTO quotes (filename, cutlist_id, quote_number) 
-- VALUES ('test-quote.pdf', 'test-cutlist-001', 'Q-20250805-0001-HDSPRO');

-- Verify the data was updated/inserted correctly
SELECT 
  id, 
  filename,
  cutlist_id,
  quote_number,
  created_at
FROM quotes 
WHERE quote_number = 'Q-20250805-0001-HDSPRO';

-- Check all quotes to see what data is available
SELECT * FROM quotes ORDER BY created_at DESC LIMIT 5;
