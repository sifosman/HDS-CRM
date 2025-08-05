-- Create the exact quote that PayFast is expecting
-- Quote ID: Q-20250805-0069-HDSBURG

-- Step 1: Create a test cutlist first (required for quotes)
INSERT INTO cutlists (
  id,
  customer_name,
  project_name,
  phone_number,
  unit,
  cut_pieces,
  stock_pieces,
  materials,
  is_confirmed,
  created_at,
  updated_at
) VALUES (
  'cutlist-payfast-0069',
  'Test Customer',
  'PayFast Test Project',
  '+27123456789',
  'mm',
  '[{"id": "1", "width": 1800, "length": 600, "quantity": 2, "material": "White Melamine"}, {"id": "2", "width": 900, "length": 400, "quantity": 4, "material": "White Melamine"}]',
  '[]',
  '["White Melamine"]',
  true,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Step 2: Create the specific quote that matches PayFast callback
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
  created_at,
  updated_at
) VALUES (
  'quote-payfast-0069',
  'Q-20250805-0069-HDSBURG-quote.pdf',
  'cutlist-payfast-0069',
  'Q-20250805-0069-HDSBURG',
  'Test Customer',
  '+27123456789',
  'test@hds.com',
  'PayFast Test Project',
  '{"customerName": "Test Customer", "customerPhone": "+27123456789", "customerEmail": "test@hds.com", "projectName": "PayFast Test Project", "items": [{"description": "White Melamine Panel", "quantity": 2, "unitPrice": 450.00, "total": 900.00}, {"description": "Edge Banding", "quantity": 8, "unitPrice": 25.00, "total": 200.00}], "subtotal": 1100.00, "tax": 165.00, "total": 1265.00}',
  1100.00,
  165.00,
  1265.00,
  'pending',
  'https://example.com/cutlist-payfast-0069',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Step 3: Verify the quote was created
SELECT 
  id,
  quote_number,
  customer_name,
  project_name,
  total,
  status
FROM quotes 
WHERE quote_number = 'Q-20250805-0069-HDSBURG';
