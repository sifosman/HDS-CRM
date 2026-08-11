"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createMetaTemplate,
  getMetaTemplate,
  isMetaConfigured,
  MetaGraphApiError,
  type CreateTemplateInput,
} from "@/lib/meta/client";

type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

/**
 * Save a template draft to Supabase (no Meta submission).
 */
export async function saveTemplateDraft(
  input: CreateTemplateInput
): Promise<ActionResult> {
  try {
    const supabase = createAdminClient();

    // Count variables in body/header ({{1}}, {{2}}, ...)
    const allText = `${input.headerText || ""} ${input.bodyText}`;
    const varMatches = allText.match(/\{\{(\d+)\}\}/g);
    const variableCount = varMatches
      ? new Set(varMatches.map((m) => m.match(/\d+/)?.[0])).size
      : 0;

    const { data, error } = await supabase
      .from("wa_templates")
      .insert({
        name: input.name,
        category: input.category,
        language: input.language,
        header_type: input.headerType || null,
        header_text: input.headerText || null,
        body_text: input.bodyText,
        footer: input.footer || null,
        buttons: input.buttons || [],
        variable_count: variableCount,
        status: "draft",
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    revalidatePath("/templates");
    return { ok: true, id: data.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to save template",
    };
  }
}

/**
 * Submit a template to Meta for approval and record the result.
 * If Meta is not configured, saves as draft with a note.
 */
export async function submitTemplateToMeta(
  templateId: string
): Promise<ActionResult> {
  try {
    const supabase = createAdminClient();

    const { data: existing, error: fetchErr } = await supabase
      .from("wa_templates")
      .select("*")
      .eq("id", templateId)
      .single();

    if (fetchErr || !existing) {
      return { ok: false, error: "Template not found" };
    }

    if (!isMetaConfigured()) {
      // Mark as pending so it's clear it's awaiting Meta config; the user can
      // sync later once WHATSAPP_WABA_ID is confirmed.
      await supabase
        .from("wa_templates")
        .update({ status: "pending" })
        .eq("id", templateId);
      revalidatePath("/templates");
      return {
        ok: false,
        error:
          "Meta is not configured. Template marked as pending. Set WHATSAPP_ACCESS_TOKEN, WHATSAPP_WABA_ID, and WHATSAPP_PHONE_NUMBER_ID to submit to Meta.",
      };
    }

    const input: CreateTemplateInput = {
      name: existing.name,
      category: existing.category,
      language: existing.language,
      headerType: existing.header_type === "TEXT" ? "TEXT" : null,
      headerText: existing.header_text,
      bodyText: existing.body_text,
      footer: existing.footer,
      buttons: existing.buttons || [],
    };

    const meta = await createMetaTemplate(input);

    await supabase
      .from("wa_templates")
      .update({
        meta_template_id: meta.id,
        status: meta.status === "APPROVED" ? "approved" : "pending",
        meta_created_at: new Date().toISOString(),
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", templateId);

    revalidatePath("/templates");
    return { ok: true, id: templateId };
  } catch (err) {
    const message =
      err instanceof MetaGraphApiError
        ? `Meta API: ${err.message}${err.code ? ` (code ${err.code})` : ""}`
        : err instanceof Error
          ? err.message
          : "Failed to submit template";
    return { ok: false, error: message };
  }
}

/**
 * Sync a template's approval status from Meta.
 */
export async function syncTemplateStatus(
  templateId: string
): Promise<ActionResult> {
  try {
    const supabase = createAdminClient();

    const { data: existing, error: fetchErr } = await supabase
      .from("wa_templates")
      .select("meta_template_id")
      .eq("id", templateId)
      .single();

    if (fetchErr || !existing) {
      return { ok: false, error: "Template not found" };
    }

    if (!existing.meta_template_id) {
      return { ok: false, error: "Template has not been submitted to Meta" };
    }

    if (!isMetaConfigured()) {
      return { ok: false, error: "Meta is not configured" };
    }

    const meta = await getMetaTemplate(existing.meta_template_id);

    const statusMap: Record<string, string> = {
      APPROVED: "approved",
      PENDING: "pending",
      REJECTED: "rejected",
      PAUSED: "paused",
      DISABLED: "disabled",
    };

    await supabase
      .from("wa_templates")
      .update({
        status: statusMap[meta.status] || meta.status.toLowerCase(),
        rejection_reason: meta.rejection_reason || null,
        last_synced_at: new Date().toISOString(),
      })
      .eq("id", templateId);

    revalidatePath("/templates");
    return { ok: true, id: templateId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to sync status",
    };
  }
}

/**
 * Delete a template (Supabase only; optionally from Meta too).
 */
export async function deleteTemplate(
  templateId: string,
  deleteFromMeta = false
): Promise<ActionResult> {
  try {
    const supabase = createAdminClient();

    if (deleteFromMeta) {
      const { data: existing } = await supabase
        .from("wa_templates")
        .select("name, meta_template_id")
        .eq("id", templateId)
        .single();

      if (existing?.name && isMetaConfigured()) {
        const { deleteMetaTemplate } = await import("@/lib/meta/client");
        try {
          await deleteMetaTemplate(existing.name);
        } catch {
          // Non-fatal: Meta may already have removed it
        }
      }
    }

    const { error } = await supabase
      .from("wa_templates")
      .delete()
      .eq("id", templateId);

    if (error) throw new Error(error.message);

    revalidatePath("/templates");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to delete template",
    };
  }
}
