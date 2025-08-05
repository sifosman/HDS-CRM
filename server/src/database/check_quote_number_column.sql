-- Check if quote_number column exists in quotes table
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'quotes' AND column_name = 'quote_number';

-- If the column exists, this will return one row
-- If the column doesn't exist, this will return no rows

-- Also check the first few rows to see if quote_number has values
SELECT id, quote_number FROM quotes LIMIT 5;
