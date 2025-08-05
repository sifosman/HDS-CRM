-- Create test quote data for PayFast testing
-- This will create the missing quote Q-20250805-1824-HDSERME

-- Step 1: Create a test cutlist first (required for quotes)
INSERT INTO cutlists (
  id,
  name,
  data,
  created_at,
  updated_at
) VALUES (
  'test-cutlist-payfast-001',
  'PayFast Test Cutlist',
  '{"pieces": [{"id": "1", "width": 1800, "length": 600, "quantity": 2, "material": "White Melamine"}, {"id": "2", "width": 900, "length": 400, "quantity": 4, "material": "White Melamine"}]}',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Step 2: Create the specific quote that PayFast is looking for
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
  'payfast-test-quote-001',
  'payfast-test-quote.pdf',
  'test-cutlist-payfast-001',
  'Q-20250805-1824-HDSERME',
  'PayFast Test Customer',
  '+27123456789',
  'test@payfast.com',
  'PayFast Test Project',
  '{"items": [
    {
      "description": "White Melamine Panel 1800x600mm",
      "quantity": 2,
      "unitPrice": 450.00,
      "total": 900.00
    },
    {
      "description": "White Melamine Panel 900x400mm", 
      "quantity": 4,
      "unitPrice": 250.00,
      "total": 1000.00
    },
    {
      "description": "Edge Banding",
      "quantity": 1,
      "unitPrice": 150.00,
      "total": 150.00
    }
  ], 
  "totals": {
    "subtotal": 2050.00,
    "tax": 307.50,
    "finalTotal": 2357.50
  }}',
  2050.00,
  307.50,
  2357.50,
  'approved',
  'https://example.com/payfast-test-cutlist.pdf',
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
WHERE quote_number = 'Q-20250805-1824-HDSERME';

-- Step 4: Also create a few more test quotes for future testing
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
) VALUES 
(
  'payfast-test-quote-002',
  'payfast-test-quote-2.pdf',
  'test-cutlist-payfast-001',
  'Q-20250805-0001-HDSPRO',
  'Test Customer 2',
  '+27987654321',
  'test2@example.com',
  'Kitchen Renovation',
  '{"items": [{"description": "Kitchen Cabinet Doors", "quantity": 8, "unitPrice": 350.00, "total": 2800.00}], "totals": {"subtotal": 2800.00, "tax": 420.00, "finalTotal": 3220.00}}',
  2800.00,
  420.00,
  3220.00,
  'approved',
  'https://example.com/kitchen-cutlist.pdf',
  NOW() + INTERVAL '30 days',
  NOW(),
  NOW()
),
(
  'payfast-test-quote-003',
  'payfast-test-quote-3.pdf',
  'test-cutlist-payfast-001',
  'Q-20250805-0002-CAPETOWN',
  'Test Customer 3',
  '+27555123456',
  'test3@example.com',
  'Office Furniture',
  '{"items": [{"description": "Office Desk Tops", "quantity": 4, "unitPrice": 600.00, "total": 2400.00}], "totals": {"subtotal": 2400.00, "tax": 360.00, "finalTotal": 2760.00}}',
  2400.00,
  360.00,
  2760.00,
  'approved',
  'https://example.com/office-cutlist.pdf',
  NOW() + INTERVAL '30 days',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;
