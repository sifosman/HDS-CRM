-- SQL Script to create cutlist records for existing quotes
-- This script should be run in Supabase to create missing cutlist records

-- Create a function to generate cutlist IDs based on quote IDs
CREATE OR REPLACE FUNCTION generate_cutlist_id(quote_id text)
RETURNS text AS $$
BEGIN
  RETURN 'cutlist-' || lower(regexp_replace(quote_id, '[^a-z0-9]', '-', 'g'));
END;
$$ LANGUAGE plpgsql;

-- Create missing cutlist records for quotes that don't have corresponding cutlists
INSERT INTO public.cutlists (
  id,
  customer_name,
  project_name,
  cut_pieces,
  created_at,
  updated_at
)
SELECT 
  generate_cutlist_id(q.quote_number) as id,
  q.customer_name,
  q.project_name,
  '[]'::jsonb as cut_pieces,
  q.created_at,
  q.updated_at
FROM public.quotes q
WHERE NOT EXISTS (
  SELECT 1 FROM public.cutlists c WHERE c.id = q.cutlist_id
)
AND q.cutlist_id NOT IN (SELECT id FROM public.cutlists)
ON CONFLICT (id) DO NOTHING;

-- Create a default cutlist record for testing purposes
INSERT INTO public.cutlists (
  id,
  customer_name,
  project_name,
  cut_pieces,
  created_at,
  updated_at
) VALUES (
  'cutlist-test-001',
  'Test Customer',
  'Test Project',
  '[{"length": 100, "width": 50, "quantity": 1}]'::jsonb,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Verify the cutlists table structure
SELECT 
  id,
  customer_name,
  project_name,
  created_at
FROM public.cutlists 
ORDER BY created_at DESC 
LIMIT 10;
