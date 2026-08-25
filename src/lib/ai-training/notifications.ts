import { createAdminClient } from "@/lib/supabase/admin";
import type { AdvisorChangeRequest } from "@/lib/types";

/**
 * Sends a change-request notification email via a secured n8n webhook.
 *
 * The n8n workflow "HDS AI Change Request Alert" receives a signed payload
 * and sends the email through Brevo SMTP. The dashboard never handles SMTP
 * credentials directly.
 *
 * If the webhook is not configured (N8N_CHANGE_REQUEST_WEBHOOK_URL or
 * N8N_CHANGE_REQUEST_WEBHOOK_SECRET missing), the notification is marked
 * as failed with a clear error message — the request itself is still stored.
 */

type NotificationResult = {
  status: "sent" | "failed";
  error?: string;
  providerResponse?: Record<string, unknown>;
};

export async function sendChangeRequestNotification(
  request: AdvisorChangeRequest,
  ownerEmail: string,
): Promise<NotificationResult> {
  const webhookUrl = process.env.N8N_CHANGE_REQUEST_WEBHOOK_URL;
  const webhookSecret = process.env.N8N_CHANGE_REQUEST_WEBHOOK_SECRET;

  if (!webhookUrl || !webhookSecret) {
    return {
      status: "failed",
      error:
        "Notification webhook not configured (N8N_CHANGE_REQUEST_WEBHOOK_URL or N8N_CHANGE_REQUEST_WEBHOOK_SECRET missing)",
    };
  }

  const payload = {
    requestId: request.id,
    to: "sifosman@gmail.com",
    ownerEmail,
    title: request.title,
    priority: request.priority,
    currentBehavior: request.current_behavior,
    requestedBehavior: request.requested_behavior,
    rationale: request.rationale,
    examples: request.examples,
    affectedAreas: request.affected_areas,
    risks: request.risks,
    acceptanceCriteria: request.acceptance_criteria,
    modelId: request.model_id,
    status: request.status,
    createdAt: request.created_at,
    dashboardUrl: `${process.env.NEXT_PUBLIC_SITE_URL || ""}/ai-training?request=${request.id}`,
  };

  let response: Response;
  try {
    response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Advisor-Signature": webhookSecret,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return {
      status: "failed",
      error: err instanceof Error ? err.message : "Webhook request failed",
    };
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return {
      status: "failed",
      error: `Webhook returned ${response.status}: ${body.slice(0, 300) || response.statusText}`,
    };
  }

  let providerResponse: Record<string, unknown> | undefined;
  try {
    providerResponse = (await response.json()) as Record<string, unknown>;
  } catch {
    // Response body is not JSON — that's fine
  }

  return { status: "sent", providerResponse };
}

/**
 * Updates the notification status on a change request after delivery attempt.
 */
export async function updateNotificationStatus(
  requestId: string,
  result: NotificationResult,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("ai_training_change_requests")
    .update({
      notification_status: result.status,
      notification_error: result.error ?? null,
      notification_provider_response: result.providerResponse ?? null,
      notified_at: result.status === "sent" ? new Date().toISOString() : null,
    })
    .eq("id", requestId);

  if (error) throw error;
}
