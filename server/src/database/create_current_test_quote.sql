-- Create the specific quote that's currently being tested: Q-20250805-0470-HDSCHUSTR
-- Run this in Supabase to fix the current error

-- Step 1: Create a test cutlist first (required for quotes)
INSERT INTO cutlists (
  id,
  name,
  data,
  created_at,
  updated_at
) VALUES (
  'test-cutlist-hdschustr-001',
  'HDSCHUSTR Test Cutlist',
  '{"pieces": [{"id": "1", "width": 2000, "length": 800, "quantity": 3, "material": "White Melamine"}, {"id": "2", "width": 1200, "length": 600, "quantity": 6, "material": "White Melamine"}]}',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Step 2: Create the specific quote that's currently being tested
INSERT INTO quotes (
  id,
  filename,
  cutlist_id,
  quote_number,
  customer_name,
  customer_phone,
  customer_email,
  project_name,
  quote_data,
  subtotal,
  tax,
  total,
  status,
  cutlist_url,
  expiry_date,
  created_at,
  updated_at
) VALUES (
  'hdschustr-test-quote-001',
  'hdschustr-test-quote.pdf',
  'test-cutlist-hdschustr-001',
  'Q-20250805-0470-HDSCHUSTR',
  'HDSCHUSTR Test Customer',
  '+27123456789',
  'customer@hdschustr.com',
  'HDSCHUSTR Test Project',
  '{"items": [
    {
      "description": "White Melamine Panel 2000x800mm",
      "quantity": 3,
      "unitPrice": 650.00,
      "total": 1950.00
    },
    {
      "description": "White Melamine Panel 1200x600mm", 
      "quantity": 6,
      "unitPrice": 380.00,
      "total": 2280.00
    },
    {
      "description": "Edge Banding Service",
      "quantity": 1,
      "unitPrice": 420.00,
      "total": 420.00
    }
  ], 
  "totals": {
    "subtotal": 4650.00,
    "tax": 697.50,
    "finalTotal": 5347.50
  }}',
  4650.00,
  697.50,
  5347.50,
  'approved',
  'https://example.com/hdschustr-test-cutlist.pdf',
  NOW() + INTERVAL '30 days',
  NOW(),
  NOW()
) ON CONFLICT (id) DO UPDATE SET
  quote_number = EXCLUDED.quote_number,
  customer_name = EXCLUDED.customer_name,
  customer_phone = EXCLUDED.customer_phone,
  customer_email = EXCLUDED.customer_email,
  project_name = EXCLUDED.project_name,
  quote_data = EXCLUDED.quote_data,
  subtotal = EXCLUDED.subtotal,
  tax = EXCLUDED.tax,
  total = EXCLUDED.total,
  status = EXCLUDED.status,
  updated_at = NOW();

-- Step 3: Verify the data was created correctly
SELECT 
  id,
  quote_number,
  customer_name,
  project_name,
  total,
  status,
  cutlist_id,
  created_at
FROM quotes 
WHERE quote_number = 'Q-20250805-0470-HDSCHUSTR';

-- Step 4: Check if the quote can be found by the fetchQuoteByNumber function
SELECT * FROM quotes WHERE quote_number = 'Q-20250805-0470-HDSCHUSTR';
