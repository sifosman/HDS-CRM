-- Verify that the quote data is properly set up for invoice generation
-- Run this after creating the test data

-- Check the specific quote that PayFast is looking for
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
WHERE quote_number = 'Q-20250805-1824-HDSERME';

-- Verify the quote_data JSON structure
SELECT 
  quote_number,
  json_extract_path_text(quote_data, 'totals', 'finalTotal') as final_total,
  json_array_length(quote_data->'items') as item_count
FROM quotes 
WHERE quote_number = 'Q-20250805-1824-HDSERME';

-- Check that the cutlist exists
SELECT 
  c.id,
  c.name,
  q.quote_number
FROM cutlists c
JOIN quotes q ON c.id = q.cutlist_id
WHERE q.quote_number = 'Q-20250805-1824-HDSERME';

-- List all available test quotes for PayFast testing
SELECT 
  quote_number,
  customer_name,
  total,
  status,
  created_at
FROM quotes 
WHERE quote_number LIKE 'Q-202508%'
ORDER BY created_at DESC;
