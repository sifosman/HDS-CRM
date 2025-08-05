-- Create a default cutlist for quotes that don't have a specific cutlist ID
-- This prevents the "Missing cutlist_id" error during quote creation

INSERT INTO cutlists (
  id,
  name,
  data,
  created_at,
  updated_at
) VALUES (
  'default-cutlist-001',
  'Default Cutlist for Quote Generation',
  '{"pieces": [{"id": "default", "width": 1000, "length": 500, "quantity": 1, "material": "Default Material"}], "description": "Default cutlist used when no specific cutlist is provided during quote generation"}',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Verify the default cutlist was created
SELECT * FROM cutlists WHERE id = 'default-cutlist-001';
