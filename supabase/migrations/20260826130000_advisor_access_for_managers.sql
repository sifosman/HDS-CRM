-- AI Training Advisor: grant access to managers (in addition to owners).
-- Previously the INSERT policies on sessions, messages, and change_requests
-- required is_current_user_owner(), which blocked managers at the DB level
-- even when the app code allowed them. This migration:
--   1. Creates is_current_user_advisor() — true for owner OR manager.
--   2. Drops and recreates the 4 policies that referenced is_current_user_owner()
--      so they now use is_current_user_advisor().
-- The original is_current_user_owner() is left intact (still used by the
-- /health page and its own RLS if any).

-- 1. New helper: true if the current user is an owner or manager.
CREATE OR REPLACE FUNCTION public.is_current_user_advisor()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('owner', 'manager')
  );
$$;

-- 2. Sessions: replace the owner-only INSERT policy.
DROP POLICY IF EXISTS ai_training_sessions_owner_insert ON public.ai_training_sessions;
CREATE POLICY ai_training_sessions_owner_insert
  ON public.ai_training_sessions FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid() AND public.is_current_user_advisor());

-- 3. Messages: replace the owner-only INSERT policy.
DROP POLICY IF EXISTS ai_training_messages_owner_insert ON public.ai_training_messages;
CREATE POLICY ai_training_messages_owner_insert
  ON public.ai_training_messages FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid() AND public.is_current_user_advisor());

-- 4. Change requests: replace the owner-only INSERT policy.
DROP POLICY IF EXISTS ai_training_change_requests_owner_insert ON public.ai_training_change_requests;
CREATE POLICY ai_training_change_requests_owner_insert
  ON public.ai_training_change_requests FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid() AND public.is_current_user_advisor());

-- 5. Context snapshots: replace the owner-only SELECT policy so managers
--    can also read snapshots (needed for the context-freshness badge).
DROP POLICY IF EXISTS ai_training_context_snapshots_owner_select ON public.ai_training_context_snapshots;
CREATE POLICY ai_training_context_snapshots_owner_select
  ON public.ai_training_context_snapshots FOR SELECT
  TO authenticated
  USING (public.is_current_user_advisor());

-- Grant execute on the new helper to authenticated users.
GRANT EXECUTE ON FUNCTION public.is_current_user_advisor() TO authenticated;
