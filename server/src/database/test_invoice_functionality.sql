-- Test script to verify invoice functionality works
-- Run this after creating the test quote

-- 1. Verify the quote exists and has all required fields
SELECT 
  id,
  quote_number,
  customer_name,
  customer_email,
  project_name,
  total,
  status,
  cutlist_id,
  quote_data,
  created_at
FROM quotes 
WHERE quote_number = 'Q-20250805-0470-HDSCHUSTR';

-- 2. Check the quote_data JSON structure (this is what the invoice will use)
SELECT 
  quote_number,
  json_extract_path_text(quote_data, 'totals', 'finalTotal') as final_total,
  json_array_length(quote_data->'items') as item_count,
  quote_data->'items' as items,
  quote_data->'totals' as totals
FROM quotes 
WHERE quote_number = 'Q-20250805-0470-HDSCHUSTR';

-- 3. Verify the cutlist exists (required for quote integrity)
SELECT 
  c.id as cutlist_id,
  c.name as cutlist_name,
  q.quote_number,
  q.customer_name
FROM cutlists c
JOIN quotes q ON c.id = q.cutlist_id
WHERE q.quote_number = 'Q-20250805-0470-HDSCHUSTR';

-- 4. Test the exact query that fetchQuoteByNumber uses
-- This should return exactly one row for the invoice controller to work
SELECT * FROM quotes WHERE quote_number = 'Q-20250805-0470-HDSCHUSTR' LIMIT 1;

-- 5. Show what the invoice endpoint will receive
SELECT 
  quote_number as quoteId,
  customer_name as customerName,
  project_name as projectName,
  created_at as date,
  total as grandTotal,
  quote_data
FROM quotes 
WHERE quote_number = 'Q-20250805-0470-HDSCHUSTR';
