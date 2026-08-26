-- AI Training Advisor: add pricing_changes column + spreadsheet MIME types.
-- 1. Adds a `pricing_changes` jsonb column to ai_training_change_requests
--    so structured pricing diffs (from uploaded spreadsheets) can be filed
--    alongside the existing text-based change request fields.
-- 2. Updates the storage bucket allowed_mime_types to include .xlsx/.xls.

-- 1. Add pricing_changes column ------------------------------------------------
ALTER TABLE public.ai_training_change_requests
  ADD COLUMN IF NOT EXISTS pricing_changes jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. Update storage bucket to allow spreadsheet MIME types --------------------
--    Supabase doesn't support ALTER on allowed_mime_types directly, so we
--    update the buckets row.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
    'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/jpg',
    'application/pdf',
    'text/plain', 'text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/aac',
    'audio/x-m4a', 'audio/mp4', 'audio/x-wav', 'audio/m4a'
  ]
WHERE id = 'ai-training-attachments';
