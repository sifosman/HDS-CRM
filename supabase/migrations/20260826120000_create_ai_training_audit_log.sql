-- AI Training Advisor: audit log for all advisor lifecycle events.
-- Tracks who did what, when, and the before/after state for every meaningful
-- action on sessions, messages, and change requests. DB-only (no UI surface).
--
-- Events logged:
--   session:         create, rename, archive, restore, delete, model_change
--   message:         send (user), send (assistant)
--   change_request:  create, status_change, notification_retry, notification_sent, notification_failed
--
-- Written server-side via the service-role (admin) client from server actions
-- and the chat API route. Owners can read their own rows; no client-side writes.

CREATE TABLE IF NOT EXISTS public.ai_training_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  actor_id uuid,                          -- who performed the action (usually = owner_id)
  session_id uuid,                        -- optional grouping by session
  entity_type text NOT NULL,              -- 'session' | 'message' | 'change_request'
  entity_id uuid,                         -- PK of the affected row (nullable for deletes/aggregate events)
  action text NOT NULL,                   -- 'create' | 'rename' | 'archive' | 'restore' | 'delete' | 'model_change' | 'send' | 'status_change' | 'notification_retry' | 'notification_sent' | 'notification_failed'
  before jsonb,                           -- JSON snapshot of relevant state before the change
  after jsonb,                            -- JSON snapshot of relevant state after the change
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,  -- extra context (model_id, tokens, cost, source, etc.)
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_training_audit_log_pkey PRIMARY KEY (id),
  CONSTRAINT ai_training_audit_log_owner_fkey
    FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT ai_training_audit_log_actor_fkey
    FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT ai_training_audit_log_session_fkey
    FOREIGN KEY (session_id) REFERENCES public.ai_training_sessions(id) ON DELETE CASCADE,
  CONSTRAINT ai_training_audit_log_entity_type_check
    CHECK (entity_type = ANY (ARRAY['session'::text, 'message'::text, 'change_request'::text]))
);

CREATE INDEX IF NOT EXISTS ai_training_audit_log_owner_created_idx
  ON public.ai_training_audit_log (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_training_audit_log_entity_idx
  ON public.ai_training_audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS ai_training_audit_log_session_idx
  ON public.ai_training_audit_log (session_id, created_at DESC);

ALTER TABLE public.ai_training_audit_log ENABLE ROW LEVEL SECURITY;

-- Owners can read their own audit rows.
CREATE POLICY ai_training_audit_log_owner_select
  ON public.ai_training_audit_log FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

-- No INSERT/UPDATE/DELETE policy for authenticated users: all writes go
-- through the service-role (admin) client, which bypasses RLS. This prevents
-- any client-side tampering with the audit trail.
