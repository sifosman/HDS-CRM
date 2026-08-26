-- AI Training Advisor: add file attachment support
-- 1. Adds an `attachments` jsonb column to ai_training_messages
-- 2. Creates a Supabase Storage bucket for uploaded files
-- 3. Sets up RLS policies on the storage bucket (owner-only)

-- 1. Add attachments column to messages -------------------------------------
ALTER TABLE public.ai_training_messages
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 1b. Add gemini-3.7-flash to the allowed models for sessions ---------------
ALTER TABLE public.ai_training_sessions
  DROP CONSTRAINT IF EXISTS ai_training_sessions_selected_model_check;

ALTER TABLE public.ai_training_sessions
  ADD CONSTRAINT ai_training_sessions_selected_model_check
  CHECK (selected_model = ANY (ARRAY[
    'openai/gpt-5.6-sol',
    'anthropic/claude-sonnet-5',
    'moonshotai/kimi-k3',
    'deepseek/deepseek-v4-pro-0813',
    'qwen/qwen3.8-max',
    'google/gemini-3.7-flash'
  ]));

-- 2. Create storage bucket --------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ai-training-attachments',
  'ai-training-attachments',
  false,
  20971520, -- 20 MB
  ARRAY[
    'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/jpg',
    'application/pdf',
    'text/plain', 'text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg', 'audio/aac',
    'audio/x-m4a', 'audio/mp4', 'audio/x-wav', 'audio/m4a'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage RLS policies ---------------------------------------------------
-- Allow owners to manage their own files (path prefix: {owner_id}/...)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Select: owners can read their own files
DROP POLICY IF EXISTS ai_training_attachments_owner_select ON storage.objects;
CREATE POLICY ai_training_attachments_owner_select
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'ai-training-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Insert: owners can upload to their own prefix
DROP POLICY IF EXISTS ai_training_attachments_owner_insert ON storage.objects;
CREATE POLICY ai_training_attachments_owner_insert
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'ai-training-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Update: owners can update their own files
DROP POLICY IF EXISTS ai_training_attachments_owner_update ON storage.objects;
CREATE POLICY ai_training_attachments_owner_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'ai-training-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'ai-training-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Delete: owners can delete their own files
DROP POLICY IF EXISTS ai_training_attachments_owner_delete ON storage.objects;
CREATE POLICY ai_training_attachments_owner_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'ai-training-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
