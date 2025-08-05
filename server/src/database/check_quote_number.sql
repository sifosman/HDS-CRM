-- Check if quote_number column exists in quotes table
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'quotes' AND column_name = 'quote_number';

-- Check first few rows to see if quote_number has values
SELECT id, quote_number FROM quotes LIMIT 5;
