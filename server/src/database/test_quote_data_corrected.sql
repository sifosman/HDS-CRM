-- Script to insert test quote data for testing PayFast integration
-- This version matches the actual quotes table schema

-- First, let's check the structure of the quotes table
-- DESCRIBE quotes;

-- Insert a test quote with a human-readable quote number
INSERT INTO quotes (
  quote_number, 
  customer_name, 
  customer_phone, 
  customer_email, 
  items, 
  subtotal, 
  tax, 
  total, 
  status, 
  cutlist_url, 
  expiry_date
) VALUES (
  'Q-20250805-0001-HDSPRO', -- Human-readable quote number with branch abbreviation
  'Test Customer',
  '+27123456789',
  'test@example.com',
  '[{"description": "Test Item", "quantity": 1, "unitPrice": 1000.00, "total": 1000.00}]'::jsonb,
  1000.00,
  150.00,
  1150.00,
  'approved',
  'https://example.com/cutlist.pdf',
  NOW() + INTERVAL '30 days'
);

-- Verify the data was inserted correctly
SELECT 
  id, 
  quote_number, 
  customer_name, 
  customer_phone, 
  customer_email, 
  subtotal, 
  tax, 
  total, 
  status, 
  created_at
FROM quotes 
WHERE quote_number = 'Q-20250805-0001-HDSPRO';

-- You can also check all quotes to see the data
SELECT * FROM quotes ORDER BY created_at DESC LIMIT 5;
