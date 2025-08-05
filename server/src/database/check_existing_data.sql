-- Check existing data in database
-- Run this first to see what's available

-- Check existing quotes
SELECT 
  id, 
  quote_number, 
  customer_name, 
  status, 
  cutlist_id, 
  total,
  created_at 
FROM quotes 
ORDER BY created_at DESC 
LIMIT 10;

-- Check existing cutlists
SELECT 
  id, 
  name, 
  created_at 
FROM cutlists 
ORDER BY created_at DESC 
LIMIT 5;

-- Check if the specific quote exists
SELECT * FROM quotes WHERE quote_number = 'Q-20250805-1824-HDSERME';
