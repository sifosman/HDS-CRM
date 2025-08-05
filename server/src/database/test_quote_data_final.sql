-- Script to insert test quote data for testing PayFast integration
-- This version matches the actual quotes table schema in Supabase

-- First, let's check if we have a cutlist to reference
-- SELECT id FROM cutlists LIMIT 1;

-- If you don't have a cutlist, you might need to create one first or use an existing one
-- For this example, I'll assume you have a cutlist with a known ID
-- Replace 'existing-cutlist-id' with an actual cutlist ID from your database

-- Insert a test quote with a human-readable quote number
INSERT INTO quotes (
  filename, 
  cutlist_id, 
  quote_number
) VALUES (
  'test-quote.pdf',
  'existing-cutlist-id', -- Replace with actual cutlist ID
  'Q-20250805-0001-HDSPRO' -- Human-readable quote number with branch abbreviation
);

-- If you want to update an existing quote to add a quote_number, use this instead:
-- UPDATE quotes SET quote_number = 'Q-20250805-0001-HDSPRO' WHERE id = 'existing-quote-id';

-- Verify the data was inserted/updated correctly
SELECT 
  id, 
  filename,
  cutlist_id,
  quote_number,
  created_at
FROM quotes 
WHERE quote_number = 'Q-20250805-0001-HDSPRO';

-- You can also check all quotes to see the data
SELECT * FROM quotes ORDER BY created_at DESC LIMIT 5;
