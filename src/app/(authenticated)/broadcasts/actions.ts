"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveSegmentRecipients } from "@/lib/segments";
import { sendTemplateMessage, isMetaConfigured } from "@/lib/meta/client";
import type { BroadcastRecipient } from "@/lib/types";

type ActionResult =
  | { ok: true; id?: string; count?: number }
  | { ok: false; error: string };

/**
 * Preview recipients for a segment without creating a campaign.
 */
export async function previewSegmentRecipients(
  segmentId: string,
  testMode: boolean
): Promise<{ ok: true; recipients: { phone_number: string; name: string | null }[] } | { ok: false; error: string }> {
  try {
    const supabase = createAdminClient();
    const { data: segment, error } = await supabase
      .from("broadcast_segments")
      .select("*")
      .eq("id", segmentId)
      .single();

    if (error || !segment) {
      return { ok: false, error: "Segment not found" };
    }

    const recipients = await resolveSegmentRecipients(segment, {
      includeTestNumbers: testMode,
      limit: 50,
    });

    return {
      ok: true,
      recipients: recipients.map((r) => ({
        phone_number: r.phone_number,
        name: r.name,
      })),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to preview recipients",
    };
  }
}

/**
 * Create a broadcast campaign and materialise the recipient list.
 */
export async function createBroadcastCampaign(
  input: {
    name: string;
    templateId: string;
    segmentId: string;
    scheduledAt: string | null;
    testMode: boolean;
  }
): Promise<ActionResult> {
  try {
    const supabase = createAdminClient();

    const { data: segment, error: segErr } = await supabase
      .from("broadcast_segments")
      .select("*")
      .eq("id", input.segmentId)
      .single();
    if (segErr || !segment) {
      return { ok: false, error: "Segment not found" };
    }

    const { data: template, error: tplErr } = await supabase
      .from("wa_templates")
      .select("name, language, status")
      .eq("id", input.templateId)
      .single();
    if (tplErr || !template) {
      return { ok: false, error: "Template not found" };
    }
    if (template.status !== "approved") {
      return {
        ok: false,
        error: "Template must be approved by Meta before sending",
      };
    }

    const recipients = await resolveSegmentRecipients(segment, {
      includeTestNumbers: input.testMode,
    });

    if (recipients.length === 0) {
      return {
        ok: false,
        error: "No eligible recipients in this segment (all opted out or filtered)",
      };
    }

    const { data: campaign, error: campErr } = await supabase
      .from("broadcast_campaigns")
      .insert({
        name: input.name,
        template_id: input.templateId,
        segment_id: input.segmentId,
        message_template: template.name,
        status: input.scheduledAt ? "scheduled" : "draft",
        total_recipients: recipients.length,
        scheduled_at: input.scheduledAt,
        test_mode: input.testMode,
      })
      .select("id")
      .single();

    if (campErr || !campaign) {
      return { ok: false, error: campErr?.message || "Failed to create campaign" };
    }

    // Materialise recipient rows
    const rows = recipients.map((r) => ({
      campaign_id: campaign.id,
      phone: r.phone_number,
      customer_name: r.name,
      status: "pending" as const,
    }));

    const { error: recErr } = await supabase
      .from("broadcast_recipients")
      .insert(rows);

    if (recErr) {
      // Cleanup the empty campaign so the user can retry
      await supabase.from("broadcast_campaigns").delete().eq("id", campaign.id);
      return { ok: false, error: recErr.message };
    }

    revalidatePath("/broadcasts");
    return { ok: true, id: campaign.id, count: recipients.length };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to create campaign",
    };
  }
}

/**
 * Send a broadcast campaign immediately. Sends via Meta Cloud API with
 * simple rate limiting (delay between sends). Updates recipient rows as it goes.
 *
 * In test mode, only sends to test numbers (27900000001–27900000200).
 */
export async function sendBroadcastCampaign(
  campaignId: string
): Promise<ActionResult> {
  try {
    const supabase = createAdminClient();

    const { data: campaign, error: campErr } = await supabase
      .from("broadcast_campaigns")
      .select("*, template:wa_templates(name, language, status)")
      .eq("id", campaignId)
      .single();

    if (campErr || !campaign) {
      return { ok: false, error: "Campaign not found" };
    }

    const template = campaign.template as {
      name: string;
      language: string;
      status: string;
    } | null;

    if (!template) {
      return { ok: false, error: "Template not linked to campaign" };
    }
    if (template.status !== "approved") {
      return { ok: false, error: "Template is not approved by Meta" };
    }
    if (!isMetaConfigured()) {
      return {
        ok: false,
        error:
          "Meta is not configured. Set WHATSAPP_ACCESS_TOKEN, WHATSAPP_WABA_ID, and WHATSAPP_PHONE_NUMBER_ID.",
      };
    }

    // Mark campaign as sending
    await supabase
      .from("broadcast_campaigns")
      .update({ status: "sending", started_at: new Date().toISOString() })
      .eq("id", campaignId);

    const { data: pendingRecipients } = await supabase
      .from("broadcast_recipients")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("status", "pending");

    const recipients = (pendingRecipients || []) as BroadcastRecipient[];

    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of recipients) {
      try {
        const { wa_message_id } = await sendTemplateMessage(
          template.name,
          template.language,
          recipient.phone
        );

        await supabase
          .from("broadcast_recipients")
          .update({
            status: "sent",
            wa_message_id,
            sent_at: new Date().toISOString(),
          })
          .eq("id", recipient.id);

        sentCount++;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Send failed";
        await supabase
          .from("broadcast_recipients")
          .update({
            status: "failed",
            error_message: message,
          })
          .eq("id", recipient.id);

        failedCount++;
      }

      // Rate limit: ~5 messages/sec to respect messaging tiers
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    await supabase
      .from("broadcast_campaigns")
      .update({
        status: "sent",
        sent_count: sentCount,
        failed_count: failedCount,
        completed_at: new Date().toISOString(),
      })
      .eq("id", campaignId);

    revalidatePath("/broadcasts");
    revalidatePath(`/broadcasts/${campaignId}`);
    return { ok: true, id: campaignId, count: sentCount };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to send campaign",
    };
  }
}

/**
 * Cancel a scheduled/draft campaign.
 */
export async function cancelBroadcastCampaign(
  campaignId: string
): Promise<ActionResult> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("broadcast_campaigns")
      .update({ status: "cancelled" })
      .eq("id", campaignId)
      .in("status", ["draft", "scheduled"]);

    if (error) throw new Error(error.message);

    revalidatePath("/broadcasts");
    return { ok: true, id: campaignId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to cancel campaign",
    };
  }
}
