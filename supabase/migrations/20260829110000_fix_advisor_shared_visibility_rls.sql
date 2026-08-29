-- Fix RLS policies so all owners/managers (advisors) can see all AI training
-- sessions, messages, and change requests — not just their own.
-- The previous code change removed the owner_id filter from queries, but RLS
-- still enforced it, blocking shared visibility.

-- 1. ai_training_sessions: allow any advisor to SELECT any session
DROP POLICY IF EXISTS ai_training_sessions_owner_select ON ai_training_sessions;
CREATE POLICY ai_training_sessions_owner_select ON ai_training_sessions
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR is_current_user_advisor());

-- 2. ai_training_messages: allow any advisor to SELECT all messages
DROP POLICY IF EXISTS ai_training_messages_owner_select ON ai_training_messages;
CREATE POLICY ai_training_messages_owner_select ON ai_training_messages
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR is_current_user_advisor());

-- 3. ai_training_change_requests: allow any advisor to SELECT all change requests
DROP POLICY IF EXISTS ai_training_change_requests_owner_select ON ai_training_change_requests;
CREATE POLICY ai_training_change_requests_owner_select ON ai_training_change_requests
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR is_current_user_advisor());
