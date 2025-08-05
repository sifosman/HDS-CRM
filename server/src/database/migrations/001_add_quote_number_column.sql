-- Add quote_number column to quotes table
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS quote_number VARCHAR(255) UNIQUE;

-- Add a comment to the column for documentation
COMMENT ON COLUMN quotes.quote_number IS 'Human-readable quote identifier with branch information';

-- Create an index on the quote_number column for better performance
CREATE INDEX IF NOT EXISTS idx_quotes_quote_number ON quotes (quote_number);
