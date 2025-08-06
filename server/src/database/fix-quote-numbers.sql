-- Fix existing quotes that have quote_number as NULL
-- This script extracts the quote number from the filename and updates the quote_number field

-- First, let's see the current state of quotes with null quote_number
SELECT 
  id,
  filename,
  quote_number,
  created_at
FROM quotes 
WHERE quote_number IS NULL
ORDER BY created_at DESC;

-- Update quotes where quote_number is NULL by extracting from filename
-- This handles filenames like "Q-20250806-4477-HDSCHUSTR" or "Q-20250806-4477-HDSCHUSTR.pdf"
UPDATE quotes 
SET quote_number = CASE 
  -- If filename contains a dot (file extension), remove everything after the last dot
  WHEN filename LIKE '%.%' THEN 
    LEFT(filename, LENGTH(filename) - LENGTH(SUBSTRING(filename FROM '\.[^.]*$')))
  -- Otherwise use the filename as-is
  ELSE filename
END,
updated_at = NOW()
WHERE quote_number IS NULL 
  AND filename IS NOT NULL
  AND filename != '';

-- Verify the fix worked
SELECT 
  id,
  filename,
  quote_number,
  created_at,
  'FIXED' as status
FROM quotes 
WHERE quote_number IS NOT NULL
  AND quote_number != ''
ORDER BY created_at DESC
LIMIT 10;

-- Check if there are any remaining quotes with null quote_number
SELECT 
  COUNT(*) as remaining_null_quote_numbers
FROM quotes 
WHERE quote_number IS NULL;

-- Show specific quote that was causing the invoice download issue
SELECT 
  id,
  filename,
  quote_number,
  customer_name,
  customer_email,
  status,
  created_at
FROM quotes 
WHERE filename = 'Q-20250806-4477-HDSCHUSTR'
   OR quote_number = 'Q-20250806-4477-HDSCHUSTR';
