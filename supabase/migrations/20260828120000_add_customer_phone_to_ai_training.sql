-- Add nullable customer_phone column to link sessions to specific customers.
-- When set, the session is shared (any owner/manager can read and write) so the
-- whole team can discuss a single customer's WhatsApp conversation with the AI
-- advisor from the customer detail page.
ALTER TABLE public.ai_training_sessions
  ADD COLUMN IF NOT EXISTS customer_phone text;

-- Index for fast lookup by customer phone
CREATE INDEX IF NOT EXISTS ai_training_sessions_customer_phone_idx
  ON public.ai_training_sessions (customer_phone)
  WHERE customer_phone IS NOT NULL;

-- Shared sessions (customer_phone IS NOT NULL): any advisor can SELECT
DROP POLICY IF EXISTS ai_training_sessions_owner_select ON public.ai_training_sessions;
CREATE POLICY ai_training_sessions_owner_select
  ON public.ai_training_sessions FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR (customer_phone IS NOT NULL AND public.is_current_user_advisor())
  );

-- Shared sessions: any advisor can INSERT messages (for the linked session)
DROP POLICY IF EXISTS ai_training_messages_owner_insert ON public.ai_training_messages;
CREATE POLICY ai_training_messages_owner_insert
  ON public.ai_training_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    (owner_id = auth.uid() AND public.is_current_user_advisor())
    OR (
      public.is_current_user_advisor()
      AND EXISTS (
        SELECT 1 FROM public.ai_training_sessions s
        WHERE s.id = session_id AND s.customer_phone IS NOT NULL
      )
    )
  );

-- Shared sessions: any advisor can UPDATE messages (for metadata)
DROP POLICY IF EXISTS ai_training_messages_owner_update ON public.ai_training_messages;
CREATE POLICY ai_training_messages_owner_update
  ON public.ai_training_messages FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.ai_training_sessions s
      WHERE s.id = session_id AND s.customer_phone IS NOT NULL
    )
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.ai_training_sessions s
      WHERE s.id = session_id AND s.customer_phone IS NOT NULL
    )
  );

-- Shared sessions: any advisor can UPDATE the session (last_message_at etc.)
DROP POLICY IF EXISTS ai_training_sessions_owner_update ON public.ai_training_sessions;
CREATE POLICY ai_training_sessions_owner_update
  ON public.ai_training_sessions FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR (customer_phone IS NOT NULL AND public.is_current_user_advisor())
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR (customer_phone IS NOT NULL AND public.is_current_user_advisor())
  );
