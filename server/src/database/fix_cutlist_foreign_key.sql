-- SQL Script to fix cutlist foreign key constraint issues
-- Run this script in Supabase to resolve foreign key violations

-- Step 1: Create missing cutlist records for existing quotes
-- This will create cutlist records for any quotes that reference non-existent cutlist IDs

INSERT INTO public.cutlists (
  id,
  customer_name,
  project_name,
  cut_pieces,
  created_at,
  updated_at
)
SELECT 
  q.cutlist_id,
  q.customer_name,
  q.project_name,
  '[]'::jsonb,
  q.created_at,
  q.updated_at
FROM public.quotes q
WHERE NOT EXISTS (
  SELECT 1 FROM public.cutlists c WHERE c.id = q.cutlist_id
)
AND q.cutlist_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- Step 2: Create a default cutlist record for testing
INSERT INTO public.cutlists (
  id,
  customer_name,
  project_name,
  cut_pieces,
  created_at,
  updated_at
) VALUES (
  'cutlist-default-001',
  'Default Customer',
  'Default Project',
  '[]'::jsonb,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Step 3: Update any quotes with invalid cutlist_id references
-- Update quotes that reference the old hardcoded value
UPDATE public.quotes 
SET cutlist_id = 'cutlist-default-001'
WHERE cutlist_id = 'default-cutlist-001'
AND NOT EXISTS (
  SELECT 1 FROM public.cutlists WHERE id = 'default-cutlist-001'
);

-- Step 4: Verify the fix
-- Check for any remaining foreign key violations
SELECT 
  q.id as quote_id,
  q.quote_number,
  q.cutlist_id,
  q.customer_name,
  q.project_name,
  c.id as cutlist_exists
FROM public.quotes q
LEFT JOIN public.cutlists c ON q.cutlist_id = c.id
WHERE c.id IS NULL;

-- Step 5: Create an index for better performance
CREATE INDEX IF NOT EXISTS idx_quotes_cutlist_id ON public.quotes(cutlist_id);
CREATE INDEX IF NOT EXISTS idx_cutlists_id ON public.cutlists(id);

-- Step 6: Display current cutlist records
SELECT 
  id,
  customer_name,
  project_name,
  created_at
FROM public.cutlists 
ORDER BY created_at DESC 
LIMIT 10;

-- Step 7: Display current quotes with their cutlist references
SELECT 
  q.id,
  q.quote_number,
  q.cutlist_id,
  q.customer_name,
  q.project_name,
  c.customer_name as cutlist_customer,
  c.project_name as cutlist_project
FROM public.quotes q
LEFT JOIN public.cutlists c ON q.cutlist_id = c.id
ORDER BY q.created_at DESC 
LIMIT 10;
