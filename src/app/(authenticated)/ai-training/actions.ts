"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { DEFAULT_ADVISOR_MODEL, isValidAdvisorModel } from "@/lib/ai-training/models";
import {
  createSessionSchema,
  renameSessionSchema,
  archiveSessionSchema,
  changeRequestDraftSchema,
  retryNotificationSchema,
  updateRequestStatusSchema,
} from "@/lib/ai-training/validation";
import {
  sendChangeRequestNotification,
  updateNotificationStatus,
} from "@/lib/ai-training/notifications";
import { logAdvisorEvent } from "@/lib/ai-training/audit";
import type {
  AdvisorSession,
  AdvisorMessage,
  AdvisorChangeRequest,
} from "@/lib/types";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export async function createSessionAction(
  input?: { title?: string; selectedModel?: string },
): Promise<ActionResult<AdvisorSession>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated" };
  if (user.role !== "owner" && user.role !== "manager")
    return { ok: false, error: "Only owners and managers can use the AI Training Advisor" };

  const parsed = createSessionSchema.safeParse(input ?? {});
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_training_sessions")
    .insert({
      owner_id: user.id,
      title: parsed.data.title ?? "New Chat",
      selected_model: parsed.data.selectedModel ?? DEFAULT_ADVISOR_MODEL,
    })
    .select("*")
    .single();

  if (error || !data)
    return { ok: false, error: error?.message ?? "Failed to create session" };

  await logAdvisorEvent({
    ownerId: user.id,
    actorId: user.id,
    sessionId: data.id,
    entityType: "session",
    entityId: data.id,
    action: "create",
    after: { title: data.title, selected_model: data.selected_model },
  });

  revalidatePath("/ai-training");
  return { ok: true, data: data as AdvisorSession };
}

export async function renameSessionAction(
  sessionId: string,
  title: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated" };
  if (user.role !== "owner" && user.role !== "manager")
    return { ok: false, error: "Only owners and managers can use the AI Training Advisor" };

  const parsed = renameSessionSchema.safeParse({ sessionId, title });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("ai_training_sessions")
    .select("title")
    .eq("id", sessionId)
    .eq("owner_id", user.id)
    .maybeSingle();

  const { error } = await supabase
    .from("ai_training_sessions")
    .update({ title: parsed.data.title })
    .eq("id", sessionId)
    .eq("owner_id", user.id);

  if (error) return { ok: false, error: error.message };

  await logAdvisorEvent({
    ownerId: user.id,
    actorId: user.id,
    sessionId,
    entityType: "session",
    entityId: sessionId,
    action: "rename",
    before: existing ? { title: existing.title } : undefined,
    after: { title: parsed.data.title },
  });

  revalidatePath("/ai-training");
  revalidatePath(`/ai-training/${sessionId}`);
  return { ok: true, data: undefined };
}

export async function archiveSessionAction(
  sessionId: string,
  archived: boolean,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated" };
  if (user.role !== "owner" && user.role !== "manager")
    return { ok: false, error: "Only owners and managers can use the AI Training Advisor" };

  const parsed = archiveSessionSchema.safeParse({ sessionId, archived });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("ai_training_sessions")
    .select("archived_at")
    .eq("id", sessionId)
    .eq("owner_id", user.id)
    .maybeSingle();

  const { error } = await supabase
    .from("ai_training_sessions")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", sessionId)
    .eq("owner_id", user.id);

  if (error) return { ok: false, error: error.message };

  await logAdvisorEvent({
    ownerId: user.id,
    actorId: user.id,
    sessionId,
    entityType: "session",
    entityId: sessionId,
    action: archived ? "archive" : "restore",
    before: existing ? { archived_at: existing.archived_at } : undefined,
    after: { archived_at: archived ? new Date().toISOString() : null },
  });

  revalidatePath("/ai-training");
  return { ok: true, data: undefined };
}

export async function deleteSessionAction(
  sessionId: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated" };
  if (user.role !== "owner" && user.role !== "manager")
    return { ok: false, error: "Only owners and managers can use the AI Training Advisor" };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("ai_training_sessions")
    .select("title, selected_model")
    .eq("id", sessionId)
    .eq("owner_id", user.id)
    .maybeSingle();

  const { error } = await supabase
    .from("ai_training_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("owner_id", user.id);

  if (error) return { ok: false, error: error.message };

  // Log before the FK-cascade deletes the session row; session_id is null
  // here because the session no longer exists (FK is ON DELETE CASCADE).
  await logAdvisorEvent({
    ownerId: user.id,
    actorId: user.id,
    entityType: "session",
    entityId: sessionId,
    action: "delete",
    before: existing
      ? { title: existing.title, selected_model: existing.selected_model }
      : undefined,
  });

  revalidatePath("/ai-training");
  return { ok: true, data: undefined };
}

export async function updateSessionModelAction(
  sessionId: string,
  model: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated" };
  if (user.role !== "owner" && user.role !== "manager")
    return { ok: false, error: "Only owners and managers can use the AI Training Advisor" };
  if (!isValidAdvisorModel(model))
    return { ok: false, error: "Invalid model" };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("ai_training_sessions")
    .select("selected_model")
    .eq("id", sessionId)
    .eq("owner_id", user.id)
    .maybeSingle();

  const { error } = await supabase
    .from("ai_training_sessions")
    .update({ selected_model: model })
    .eq("id", sessionId)
    .eq("owner_id", user.id);

  if (error) return { ok: false, error: error.message };

  await logAdvisorEvent({
    ownerId: user.id,
    actorId: user.id,
    sessionId,
    entityType: "session",
    entityId: sessionId,
    action: "model_change",
    before: existing ? { selected_model: existing.selected_model } : undefined,
    after: { selected_model: model },
  });

  revalidatePath(`/ai-training/${sessionId}`);
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export async function getMessagesAction(
  sessionId: string,
): Promise<ActionResult<AdvisorMessage[]>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated" };
  if (user.role !== "owner" && user.role !== "manager")
    return { ok: false, error: "Only owners and managers can use the AI Training Advisor" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_training_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) return { ok: false, error: error.message };

  return { ok: true, data: (data ?? []) as AdvisorMessage[] };
}

// ---------------------------------------------------------------------------
// Change requests
// ---------------------------------------------------------------------------

export async function createChangeRequestAction(
  input: {
    sessionId?: string;
    sourceMessageId?: string;
    modelId?: string;
    contextSnapshotId?: string;
    title: string;
    currentBehavior?: string;
    requestedBehavior: string;
    rationale?: string;
    examples?: Array<{ customerMessage?: string; desiredReply?: string }>;
    affectedAreas?: string[];
    priority?: "low" | "medium" | "high" | "critical";
    risks?: string;
    acceptanceCriteria?: string;
    pricingChanges?: Array<{
      code: string;
      description?: string;
      action: "add" | "update" | "remove";
      oldPrice?: number | null;
      newPrice?: number | null;
      dimensions?: string;
      category?: string;
    }>;
  },
): Promise<ActionResult<AdvisorChangeRequest>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated" };
  if (user.role !== "owner" && user.role !== "manager")
    return { ok: false, error: "Only owners and managers can use the AI Training Advisor" };

  const parsed = changeRequestDraftSchema.safeParse({
    sessionId: input.sessionId,
    sourceMessageId: input.sourceMessageId,
    title: input.title,
    currentBehavior: input.currentBehavior,
    requestedBehavior: input.requestedBehavior,
    rationale: input.rationale,
    examples: input.examples,
    affectedAreas: input.affectedAreas,
    priority: input.priority,
    risks: input.risks,
    acceptanceCriteria: input.acceptanceCriteria,
    pricingChanges: input.pricingChanges,
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const result = await createChangeRequestRecord(user, {
    sessionId: parsed.data.sessionId,
    sourceMessageId: parsed.data.sourceMessageId,
    modelId: input.modelId,
    contextSnapshotId: input.contextSnapshotId,
    title: parsed.data.title,
    currentBehavior: parsed.data.currentBehavior,
    requestedBehavior: parsed.data.requestedBehavior,
    rationale: parsed.data.rationale,
    examples: parsed.data.examples,
    affectedAreas: parsed.data.affectedAreas,
    priority: parsed.data.priority,
    risks: parsed.data.risks,
    acceptanceCriteria: parsed.data.acceptanceCriteria,
    pricingChanges: parsed.data.pricingChanges,
  });

  if (!result.ok) return result;

  revalidatePath("/ai-training");
  revalidatePath(`/ai-training/${parsed.data.sessionId ?? ""}`);
  return result;
}

/**
 * Shared core that inserts a change request, sends the notification email, and
 * returns the final row. Used by both the server action (manual creation) and
 * the chat API route (auto-creation from a parsed ```change-request block).
 *
 * `user` is the authenticated owner. Validation is the caller's responsibility.
 */
export async function createChangeRequestRecord(
  user: { id: string; email: string },
  input: {
    sessionId?: string;
    sourceMessageId?: string;
    modelId?: string;
    contextSnapshotId?: string;
    title: string;
    currentBehavior?: string;
    requestedBehavior: string;
    rationale?: string;
    examples?: Array<{ customerMessage?: string; desiredReply?: string }>;
    affectedAreas?: string[];
    priority?: "low" | "medium" | "high" | "critical";
    risks?: string;
    acceptanceCriteria?: string;
    pricingChanges?: Array<{
      code: string;
      description?: string;
      action: "add" | "update" | "remove";
      oldPrice?: number | null;
      newPrice?: number | null;
      dimensions?: string;
      category?: string;
    }>;
  },
): Promise<ActionResult<AdvisorChangeRequest>> {
  const supabase = await createClient();

  // Insert the change request
  const { data: request, error } = await supabase
    .from("ai_training_change_requests")
    .insert({
      session_id: input.sessionId ?? null,
      source_message_id: input.sourceMessageId ?? null,
      owner_id: user.id,
      title: input.title,
      current_behavior: input.currentBehavior ?? null,
      requested_behavior: input.requestedBehavior,
      rationale: input.rationale ?? null,
      examples: input.examples ?? [],
      affected_areas: input.affectedAreas ?? [],
      priority: input.priority ?? "medium",
      risks: input.risks ?? null,
      acceptance_criteria: input.acceptanceCriteria ?? null,
      pricing_changes: input.pricingChanges ?? [],
      model_id: input.modelId ?? null,
      context_snapshot_id: input.contextSnapshotId ?? null,
      status: "pending",
      notification_status: "pending",
    })
    .select("*")
    .single();

  if (error || !request)
    return { ok: false, error: error?.message ?? "Failed to create change request" };

  await logAdvisorEvent({
    ownerId: user.id,
    actorId: user.id,
    sessionId: input.sessionId,
    entityType: "change_request",
    entityId: request.id,
    action: "create",
    after: {
      title: input.title,
      priority: input.priority ?? "medium",
      status: "pending",
      source: input.sourceMessageId ? "chat_auto" : "manual",
      source_message_id: input.sourceMessageId ?? null,
      model_id: input.modelId ?? null,
    },
  });

  // Send notification email (store-first, then notify)
  const notification = await sendChangeRequestNotification(
    request as AdvisorChangeRequest,
    user.email,
  );
  await updateNotificationStatus(request.id, notification);

  // Log the notification outcome
  await logAdvisorEvent({
    ownerId: user.id,
    actorId: user.id,
    sessionId: input.sessionId,
    entityType: "change_request",
    entityId: request.id,
    action:
      notification.status === "sent" ? "notification_sent" : "notification_failed",
    metadata: {
      notification_status: notification.status,
      error: notification.error ?? null,
    },
  });

  // Re-fetch the updated request (notification status may have changed)
  const { data: updated } = await supabase
    .from("ai_training_change_requests")
    .select("*")
    .eq("id", request.id)
    .single();

  return { ok: true, data: (updated ?? request) as AdvisorChangeRequest };
}

export async function retryNotificationAction(
  requestId: string,
): Promise<ActionResult<AdvisorChangeRequest>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated" };
  if (user.role !== "owner" && user.role !== "manager")
    return { ok: false, error: "Only owners and managers can use the AI Training Advisor" };

  const parsed = retryNotificationSchema.safeParse({ requestId });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const { data: request, error } = await supabase
    .from("ai_training_change_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (error || !request)
    return { ok: false, error: error?.message ?? "Change request not found" };

  const notification = await sendChangeRequestNotification(
    request as AdvisorChangeRequest,
    user.email,
  );
  await updateNotificationStatus(requestId, notification);

  await logAdvisorEvent({
    ownerId: user.id,
    actorId: user.id,
    sessionId: (request as AdvisorChangeRequest).session_id ?? undefined,
    entityType: "change_request",
    entityId: requestId,
    action: "notification_retry",
    metadata: {
      notification_status: notification.status,
      error: notification.error ?? null,
    },
  });

  const { data: updated } = await supabase
    .from("ai_training_change_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  revalidatePath("/ai-training");
  return { ok: true, data: updated as AdvisorChangeRequest };
}

export async function updateChangeRequestStatusAction(
  requestId: string,
  status: "pending" | "in_review" | "approved" | "implemented" | "rejected",
  implementationNotes?: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated" };
  if (user.role !== "owner" && user.role !== "manager")
    return { ok: false, error: "Only owners and managers can use the AI Training Advisor" };

  const parsed = updateRequestStatusSchema.safeParse({
    requestId,
    status,
    implementationNotes,
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("ai_training_change_requests")
    .select("status, implementation_notes, session_id")
    .eq("id", requestId)
    .maybeSingle();

  const update: Record<string, unknown> = { status: parsed.data.status };
  if (parsed.data.implementationNotes !== undefined) {
    update.implementation_notes = parsed.data.implementationNotes;
  }

  const { error } = await supabase
    .from("ai_training_change_requests")
    .update(update)
    .eq("id", requestId);

  if (error) return { ok: false, error: error.message };

  await logAdvisorEvent({
    ownerId: user.id,
    actorId: user.id,
    sessionId: existing?.session_id ?? undefined,
    entityType: "change_request",
    entityId: requestId,
    action: "status_change",
    before: existing
      ? { status: existing.status, implementation_notes: existing.implementation_notes }
      : undefined,
    after: {
      status: parsed.data.status,
      implementation_notes: parsed.data.implementationNotes ?? null,
    },
  });

  revalidatePath("/ai-training");
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Data fetching (for server components)
// ---------------------------------------------------------------------------

export async function getAdvisorSessions(): Promise<AdvisorSession[]> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "owner" && user.role !== "manager")) return [];

  // All owners/managers can see every session (not just their own) so the
  // team has shared visibility into each user's message history.
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_training_sessions")
    .select("*")
    .is("archived_at", null)
    .order("last_message_at", { ascending: false, nullsFirst: false });

  return (data ?? []) as AdvisorSession[];
}

export async function getAdvisorSession(
  sessionId: string,
): Promise<AdvisorSession | null> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "owner" && user.role !== "manager")) return null;

  // Any owner/manager can view any session (read-only if not the owner).
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_training_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  return data as AdvisorSession | null;
}

export async function getAdvisorMessages(
  sessionId: string,
): Promise<AdvisorMessage[]> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "owner" && user.role !== "manager")) return [];

  // Messages are visible to all owners/managers, not just the session owner.
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_training_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  return (data ?? []) as AdvisorMessage[];
}

export async function getAdvisorChangeRequests(
  sessionId?: string,
): Promise<AdvisorChangeRequest[]> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "owner" && user.role !== "manager")) return [];

  // All change requests are visible to every owner/manager, regardless of
  // who created them.
  const supabase = await createClient();
  let query = supabase
    .from("ai_training_change_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (sessionId) {
    query = query.eq("session_id", sessionId);
  }

  const { data } = await query;
  return (data ?? []) as AdvisorChangeRequest[];
}

/**
 * Returns a map of user_id → display name for the given user IDs, so the
 * training workspace can show who owns each session/change request. Falls
 * back to the auth email if no full_name is set.
 */
export async function getAdvisorOwnerNames(
  userIds: string[],
): Promise<Record<string, string>> {
  if (userIds.length === 0) return {};

  const admin = createAdminClient();
  const { data: roles } = await admin
    .from("user_roles")
    .select("user_id, full_name")
    .in("user_id", userIds);

  const names: Record<string, string> = {};
  for (const row of roles ?? []) {
    if (row.full_name) {
      names[row.user_id] = row.full_name;
    }
  }

  // For any IDs without a full_name, fall back to the auth email.
  const missing = userIds.filter((id) => !names[id]);
  for (const id of missing) {
    const { data: authUser } = await admin.auth.admin.getUserById(id);
    if (authUser?.user?.email) {
      names[id] = authUser.user.email;
    }
  }

  return names;
}

/**
 * Persists a user message and returns it. Used by the chat API route.
 */
export async function persistUserMessage(
  sessionId: string,
  ownerId: string,
  content: string,
  attachments?: import("@/lib/types").AdvisorAttachment[],
): Promise<AdvisorMessage | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_training_messages")
    .insert({
      session_id: sessionId,
      owner_id: ownerId,
      role: "user",
      content,
      attachments: attachments ?? [],
    })
    .select("*")
    .single();

  if (error) return null;

  // Update session's last_message_at
  await admin
    .from("ai_training_sessions")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", sessionId);

  await logAdvisorEvent({
    ownerId: ownerId,
    actorId: ownerId,
    sessionId,
    entityType: "message",
    entityId: data.id,
    action: "send",
    after: {
      role: "user",
      content_length: content.length,
      attachment_count: attachments?.length ?? 0,
      attachment_types: attachments?.map((a) => a.type) ?? [],
    },
  });

  return data as AdvisorMessage;
}

/**
 * Persists an assistant message with usage metadata. Used by the chat API route.
 */
export async function persistAssistantMessage(
  sessionId: string,
  ownerId: string,
  content: string,
  metadata: {
    modelId?: string;
    contextSnapshotId?: string;
    tokensInput?: number;
    tokensOutput?: number;
    costUsd?: number;
    metadata?: Record<string, unknown>;
  },
): Promise<AdvisorMessage | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_training_messages")
    .insert({
      session_id: sessionId,
      owner_id: ownerId,
      role: "assistant",
      content,
      model_id: metadata.modelId ?? null,
      context_snapshot_id: metadata.contextSnapshotId ?? null,
      tokens_input: metadata.tokensInput ?? null,
      tokens_output: metadata.tokensOutput ?? null,
      cost_usd: metadata.costUsd ?? null,
      metadata: metadata.metadata ?? {},
    })
    .select("*")
    .single();

  if (error) return null;

  // Update session's last_message_at
  await admin
    .from("ai_training_sessions")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", sessionId);

  await logAdvisorEvent({
    ownerId: ownerId,
    // Assistant messages are generated by the model, not a human actor.
    // actor_id defaults to ownerId so the row is attributable to the session owner.
    sessionId,
    entityType: "message",
    entityId: data.id,
    action: "send",
    after: {
      role: "assistant",
      model_id: metadata.modelId ?? null,
      tokens_input: metadata.tokensInput ?? null,
      tokens_output: metadata.tokensOutput ?? null,
      cost_usd: metadata.costUsd ?? null,
      content_length: content.length,
    },
  });

  return data as AdvisorMessage;
}

/**
 * Auto-generates a session title from the first user message.
 */
export async function autoGenerateTitle(
  sessionId: string,
  firstMessage: string,
): Promise<void> {
  const title = firstMessage.slice(0, 80).trim() || "New Chat";
  const admin = createAdminClient();
  await admin
    .from("ai_training_sessions")
    .update({ title })
    .eq("id", sessionId);
}
