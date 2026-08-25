-- AI Training Advisor: owner-only workspace for sales-training suggestions
-- Creates sessions, messages, sanitized context snapshots, and change requests.
-- All tables have RLS enabled with owner-scoped policies.
-- Applied via Supabase MCP on 2026-08-24.

-- Helper: returns true if the current auth.uid() has the 'owner' role.
CREATE OR REPLACE FUNCTION public.is_current_user_owner()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'owner'
  );
$$;

-- 1. Sessions ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_training_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'New Chat',
  selected_model text NOT NULL DEFAULT 'anthropic/claude-sonnet-5',
  summary text,
  last_message_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_training_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT ai_training_sessions_owner_id_fkey
    FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT ai_training_sessions_selected_model_check
    CHECK (selected_model = ANY (ARRAY[
      'openai/gpt-5.6-sol',
      'anthropic/claude-sonnet-5',
      'moonshotai/kimi-k3',
      'deepseek/deepseek-v4-pro-0813',
      'qwen/qwen3.8-max'
    ]))
);

CREATE INDEX IF NOT EXISTS ai_training_sessions_owner_last_msg_idx
  ON public.ai_training_sessions (owner_id, last_message_at DESC);

ALTER TABLE public.ai_training_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_training_sessions_owner_select
  ON public.ai_training_sessions FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY ai_training_sessions_owner_insert
  ON public.ai_training_sessions FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid() AND public.is_current_user_owner());

CREATE POLICY ai_training_sessions_owner_update
  ON public.ai_training_sessions FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY ai_training_sessions_owner_delete
  ON public.ai_training_sessions FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

CREATE TRIGGER ai_training_sessions_updated_at
  BEFORE UPDATE ON public.ai_training_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 2. Messages ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_training_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  model_id text,
  context_snapshot_id uuid,
  tokens_input integer,
  tokens_output integer,
  cost_usd numeric(10,6),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_training_messages_pkey PRIMARY KEY (id),
  CONSTRAINT ai_training_messages_session_fkey
    FOREIGN KEY (session_id) REFERENCES public.ai_training_sessions(id) ON DELETE CASCADE,
  CONSTRAINT ai_training_messages_owner_fkey
    FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT ai_training_messages_role_check
    CHECK (role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text]))
);

CREATE INDEX IF NOT EXISTS ai_training_messages_session_created_idx
  ON public.ai_training_messages (session_id, created_at);

ALTER TABLE public.ai_training_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_training_messages_owner_select
  ON public.ai_training_messages FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY ai_training_messages_owner_insert
  ON public.ai_training_messages FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid() AND public.is_current_user_owner());

CREATE POLICY ai_training_messages_owner_update
  ON public.ai_training_messages FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY ai_training_messages_owner_delete
  ON public.ai_training_messages FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- 3. Context snapshots ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_training_context_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  content_hash text NOT NULL,
  workflow_version text,
  workflow_model text,
  system_prompt text,
  tool_contracts jsonb NOT NULL DEFAULT '[]'::jsonb,
  topology jsonb NOT NULL DEFAULT '{}'::jsonb,
  dashboard_manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  supabase_aggregates jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_timestamps jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_stale boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_training_context_snapshots_pkey PRIMARY KEY (id),
  CONSTRAINT ai_training_context_snapshots_hash_unique
    UNIQUE (content_hash)
);

CREATE INDEX IF NOT EXISTS ai_training_context_snapshots_created_idx
  ON public.ai_training_context_snapshots (created_at DESC);

ALTER TABLE public.ai_training_context_snapshots ENABLE ROW LEVEL SECURITY;

-- Snapshots are written by the service role (server-side only).
-- Owners can read them for display; no client-side writes.
CREATE POLICY ai_training_context_snapshots_owner_select
  ON public.ai_training_context_snapshots FOR SELECT
  TO authenticated
  USING (public.is_current_user_owner());

-- 4. Change requests --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_training_change_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid,
  source_message_id uuid,
  owner_id uuid NOT NULL,
  title text NOT NULL,
  current_behavior text,
  requested_behavior text NOT NULL,
  rationale text,
  examples jsonb NOT NULL DEFAULT '[]'::jsonb,
  affected_areas text[] NOT NULL DEFAULT '{}'::text[],
  priority text NOT NULL DEFAULT 'medium',
  risks text,
  acceptance_criteria text,
  status text NOT NULL DEFAULT 'pending',
  implementation_notes text,
  model_id text,
  context_snapshot_id uuid,
  notification_status text NOT NULL DEFAULT 'pending',
  notification_error text,
  notification_provider_response jsonb,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_training_change_requests_pkey PRIMARY KEY (id),
  CONSTRAINT ai_training_change_requests_session_fkey
    FOREIGN KEY (session_id) REFERENCES public.ai_training_sessions(id) ON DELETE SET NULL,
  CONSTRAINT ai_training_change_requests_owner_fkey
    FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT ai_training_change_requests_priority_check
    CHECK (priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])),
  CONSTRAINT ai_training_change_requests_status_check
    CHECK (status = ANY (ARRAY['pending'::text, 'in_review'::text, 'approved'::text, 'implemented'::text, 'rejected'::text])),
  CONSTRAINT ai_training_change_requests_notification_check
    CHECK (notification_status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text]))
);

CREATE INDEX IF NOT EXISTS ai_training_change_requests_owner_created_idx
  ON public.ai_training_change_requests (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_training_change_requests_session_idx
  ON public.ai_training_change_requests (session_id);

ALTER TABLE public.ai_training_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_training_change_requests_owner_select
  ON public.ai_training_change_requests FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY ai_training_change_requests_owner_insert
  ON public.ai_training_change_requests FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid() AND public.is_current_user_owner());

CREATE POLICY ai_training_change_requests_owner_update
  ON public.ai_training_change_requests FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY ai_training_change_requests_owner_delete
  ON public.ai_training_change_requests FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

CREATE TRIGGER ai_training_change_requests_updated_at
  BEFORE UPDATE ON public.ai_training_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Grant the is_current_user_owner function to authenticated users.
GRANT EXECUTE ON FUNCTION public.is_current_user_owner() TO authenticated;
