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
  if (user.role !== "owner")
    return { ok: false, error: "Only owners can use the AI Training Advisor" };

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

  revalidatePath("/ai-training");
  return { ok: true, data: data as AdvisorSession };
}

export async function renameSessionAction(
  sessionId: string,
  title: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated" };
  if (user.role !== "owner")
    return { ok: false, error: "Only owners can use the AI Training Advisor" };

  const parsed = renameSessionSchema.safeParse({ sessionId, title });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("ai_training_sessions")
    .update({ title: parsed.data.title })
    .eq("id", sessionId)
    .eq("owner_id", user.id);

  if (error) return { ok: false, error: error.message };

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
  if (user.role !== "owner")
    return { ok: false, error: "Only owners can use the AI Training Advisor" };

  const parsed = archiveSessionSchema.safeParse({ sessionId, archived });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("ai_training_sessions")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", sessionId)
    .eq("owner_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/ai-training");
  return { ok: true, data: undefined };
}

export async function deleteSessionAction(
  sessionId: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated" };
  if (user.role !== "owner")
    return { ok: false, error: "Only owners can use the AI Training Advisor" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("ai_training_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("owner_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/ai-training");
  return { ok: true, data: undefined };
}

export async function updateSessionModelAction(
  sessionId: string,
  model: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated" };
  if (user.role !== "owner")
    return { ok: false, error: "Only owners can use the AI Training Advisor" };
  if (!isValidAdvisorModel(model))
    return { ok: false, error: "Invalid model" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("ai_training_sessions")
    .update({ selected_model: model })
    .eq("id", sessionId)
    .eq("owner_id", user.id);

  if (error) return { ok: false, error: error.message };

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
  if (user.role !== "owner")
    return { ok: false, error: "Only owners can use the AI Training Advisor" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_training_messages")
    .select("*")
    .eq("session_id", sessionId)
    .eq("owner_id", user.id)
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
  },
): Promise<ActionResult<AdvisorChangeRequest>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated" };
  if (user.role !== "owner")
    return { ok: false, error: "Only owners can use the AI Training Advisor" };

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
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const d = parsed.data;
  const supabase = await createClient();

  // Insert the change request
  const { data: request, error } = await supabase
    .from("ai_training_change_requests")
    .insert({
      session_id: d.sessionId ?? null,
      source_message_id: d.sourceMessageId ?? null,
      owner_id: user.id,
      title: d.title,
      current_behavior: d.currentBehavior ?? null,
      requested_behavior: d.requestedBehavior,
      rationale: d.rationale ?? null,
      examples: d.examples ?? [],
      affected_areas: d.affectedAreas ?? [],
      priority: d.priority,
      risks: d.risks ?? null,
      acceptance_criteria: d.acceptanceCriteria ?? null,
      model_id: input.modelId ?? null,
      context_snapshot_id: input.contextSnapshotId ?? null,
      status: "pending",
      notification_status: "pending",
    })
    .select("*")
    .single();

  if (error || !request)
    return { ok: false, error: error?.message ?? "Failed to create change request" };

  // Send notification email (store-first, then notify)
  const notification = await sendChangeRequestNotification(
    request as AdvisorChangeRequest,
    user.email,
  );
  await updateNotificationStatus(request.id, notification);

  // Re-fetch the updated request
  const { data: updated } = await supabase
    .from("ai_training_change_requests")
    .select("*")
    .eq("id", request.id)
    .single();

  revalidatePath("/ai-training");
  revalidatePath(`/ai-training/${d.sessionId ?? ""}`);
  return { ok: true, data: (updated ?? request) as AdvisorChangeRequest };
}

export async function retryNotificationAction(
  requestId: string,
): Promise<ActionResult<AdvisorChangeRequest>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not authenticated" };
  if (user.role !== "owner")
    return { ok: false, error: "Only owners can use the AI Training Advisor" };

  const parsed = retryNotificationSchema.safeParse({ requestId });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const { data: request, error } = await supabase
    .from("ai_training_change_requests")
    .select("*")
    .eq("id", requestId)
    .eq("owner_id", user.id)
    .single();

  if (error || !request)
    return { ok: false, error: error?.message ?? "Change request not found" };

  const notification = await sendChangeRequestNotification(
    request as AdvisorChangeRequest,
    user.email,
  );
  await updateNotificationStatus(requestId, notification);

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
  if (user.role !== "owner")
    return { ok: false, error: "Only owners can use the AI Training Advisor" };

  const parsed = updateRequestStatusSchema.safeParse({
    requestId,
    status,
    implementationNotes,
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const supabase = await createClient();
  const update: Record<string, unknown> = { status: parsed.data.status };
  if (parsed.data.implementationNotes !== undefined) {
    update.implementation_notes = parsed.data.implementationNotes;
  }

  const { error } = await supabase
    .from("ai_training_change_requests")
    .update(update)
    .eq("id", requestId)
    .eq("owner_id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/ai-training");
  return { ok: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Data fetching (for server components)
// ---------------------------------------------------------------------------

export async function getAdvisorSessions(): Promise<AdvisorSession[]> {
  const user = await getCurrentUser();
  if (!user || user.role !== "owner") return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_training_sessions")
    .select("*")
    .eq("owner_id", user.id)
    .is("archived_at", null)
    .order("last_message_at", { ascending: false, nullsFirst: false });

  return (data ?? []) as AdvisorSession[];
}

export async function getAdvisorSession(
  sessionId: string,
): Promise<AdvisorSession | null> {
  const user = await getCurrentUser();
  if (!user || user.role !== "owner") return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_training_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("owner_id", user.id)
    .maybeSingle();

  return data as AdvisorSession | null;
}

export async function getAdvisorMessages(
  sessionId: string,
): Promise<AdvisorMessage[]> {
  const user = await getCurrentUser();
  if (!user || user.role !== "owner") return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_training_messages")
    .select("*")
    .eq("session_id", sessionId)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true });

  return (data ?? []) as AdvisorMessage[];
}

export async function getAdvisorChangeRequests(
  sessionId?: string,
): Promise<AdvisorChangeRequest[]> {
  const user = await getCurrentUser();
  if (!user || user.role !== "owner") return [];

  const supabase = await createClient();
  let query = supabase
    .from("ai_training_change_requests")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (sessionId) {
    query = query.eq("session_id", sessionId);
  }

  const { data } = await query;
  return (data ?? []) as AdvisorChangeRequest[];
}

/**
 * Persists a user message and returns it. Used by the chat API route.
 */
export async function persistUserMessage(
  sessionId: string,
  ownerId: string,
  content: string,
): Promise<AdvisorMessage | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_training_messages")
    .insert({
      session_id: sessionId,
      owner_id: ownerId,
      role: "user",
      content,
    })
    .select("*")
    .single();

  if (error) return null;

  // Update session's last_message_at
  await admin
    .from("ai_training_sessions")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", sessionId);

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
