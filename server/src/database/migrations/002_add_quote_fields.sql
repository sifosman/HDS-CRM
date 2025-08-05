-- Migration script to add necessary fields to the quotes table for full invoice functionality

-- Add customer information fields
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255);

-- Add project information field
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS project_name VARCHAR(255);

-- Add quote data field (JSONB for flexible storage of quote items and totals)
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS quote_data JSONB;

-- Add pricing fields
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10,2);
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS tax DECIMAL(10,2) DEFAULT 0;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS total DECIMAL(10,2);

-- Add status field with default value
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'sent';

-- Add cutlist URL field
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS cutlist_url VARCHAR(255);

-- Add expiry date field
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMP WITH TIME ZONE;

-- Update existing quotes to have default values where needed
UPDATE quotes SET status = 'sent' WHERE status IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN quotes.customer_name IS 'Customer name for the quote';
COMMENT ON COLUMN quotes.customer_phone IS 'Customer phone number';
COMMENT ON COLUMN quotes.customer_email IS 'Customer email address';
COMMENT ON COLUMN quotes.project_name IS 'Project name for the quote';
COMMENT ON COLUMN quotes.quote_data IS 'JSON data containing quote items and totals';
COMMENT ON COLUMN quotes.subtotal IS 'Subtotal amount before tax';
COMMENT ON COLUMN quotes.tax IS 'Tax amount';
COMMENT ON COLUMN quotes.total IS 'Total amount including tax';
COMMENT ON COLUMN quotes.status IS 'Current status of the quote (sent, approved, expired, etc.)';
COMMENT ON COLUMN quotes.cutlist_url IS 'URL to the cutlist file';
COMMENT ON COLUMN quotes.expiry_date IS 'Date when the quote expires';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_quotes_customer_name ON quotes (customer_name);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes (status);
CREATE INDEX IF NOT EXISTS idx_quotes_expiry_date ON quotes (expiry_date);

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'quotes' 
ORDER BY ordinal_position;
