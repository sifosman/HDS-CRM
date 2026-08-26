import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AdvisorAuditAction,
  AdvisorAuditEntityType,
} from "@/lib/types";

/**
 * Audit logging for the AI Training Advisor.
 *
 * Every meaningful lifecycle event (session create/rename/archive/delete,
 * message send, change request create/status-change/notification) is recorded
 * in `ai_training_audit_log` with the actor, timestamp, entity, and before/
 * after state.
 *
 * Writes use the service-role (admin) client, which bypasses RLS. There is no
 * INSERT policy for authenticated users, so the audit trail cannot be
 * tampered with from the client. Owners can SELECT their own rows.
 *
 * Logging is best-effort: a failure to write an audit row must never break
 * the user-facing operation that triggered it. All errors are swallowed and
 * (in development) logged to stderr.
 */

export type AuditEvent = {
  ownerId: string;
  actorId?: string;
  sessionId?: string;
  entityType: AdvisorAuditEntityType;
  entityId?: string;
  action: AdvisorAuditAction;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

/**
 * Records a single audit event. Never throws.
 */
export async function logAdvisorEvent(event: AuditEvent): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("ai_training_audit_log").insert({
      owner_id: event.ownerId,
      actor_id: event.actorId ?? event.ownerId,
      session_id: event.sessionId ?? null,
      entity_type: event.entityType,
      entity_id: event.entityId ?? null,
      action: event.action,
      before: event.before ?? null,
      after: event.after ?? null,
      metadata: event.metadata ?? {},
    });
    if (error && process.env.NODE_ENV !== "production") {
      console.error("[audit] failed to log event:", error.message);
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error(
        "[audit] error logging event:",
        err instanceof Error ? err.message : err,
      );
    }
  }
}
