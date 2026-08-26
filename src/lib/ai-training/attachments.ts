import { createAdminClient } from "@/lib/supabase/admin";
import type { AdvisorAttachment, AdvisorModelId } from "@/lib/types";
import {
  getAdvisorModel,
  AUDIO_FALLBACK_MODEL,
  VISION_FALLBACK_MODEL,
} from "./models";
import type { ContentPart } from "./openrouter";

/**
 * MIME types that indicate a spreadsheet upload.
 */
const SPREADSHEET_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

const SPREADSHEET_EXTENSIONS = [".xlsx", ".xls"];

/**
 * Maps an audio MIME type to the short format string OpenRouter expects
 * in the `input_audio` content part.
 */
const AUDIO_FORMAT_MAP: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/aac": "aac",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/mp4": "mp4",
};

/**
 * Downloads a file from Supabase Storage and returns it as a Buffer.
 */
async function downloadAttachment(
  storagePath: string,
): Promise<Buffer | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("ai-training-attachments")
    .download(storagePath);

  if (error || !data) return null;

  // Supabase JS v2 returns a Blob; convert to Buffer.
  const arrayBuffer = await (data as Blob).arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Determines whether the selected model needs to be overridden based on
 * the attachment types. Returns the effective model and a reason string
 * (for display to the user) if a switch occurred.
 */
export function resolveModelForAttachments(
  selectedModel: AdvisorModelId,
  attachments: AdvisorAttachment[],
): {
  model: AdvisorModelId;
  switched: boolean;
  reason?: string;
} {
  if (attachments.length === 0) {
    return { model: selectedModel, switched: false };
  }

  const hasAudio = attachments.some((a) => a.type === "audio");
  const hasImage = attachments.some((a) => a.type === "image");

  if (hasAudio) {
    const modelConfig = getAdvisorModel(selectedModel);
    if (!modelConfig?.supportsAudio) {
      return {
        model: AUDIO_FALLBACK_MODEL,
        switched: true,
        reason: `Audio input requires a model that supports it. Switched to Gemini 3.7 Flash for this message.`,
      };
    }
  }

  if (hasImage) {
    const modelConfig = getAdvisorModel(selectedModel);
    if (!modelConfig?.supportsVision) {
      return {
        model: VISION_FALLBACK_MODEL,
        switched: true,
        reason: `Image input requires a vision-capable model. Switched to Gemini 3.7 Flash for this message.`,
      };
    }
  }

  return { model: selectedModel, switched: false };
}

/**
 * Builds the multimodal content parts for the current user message.
 * - Images: downloaded from storage, converted to base64 data URLs
 * - Documents: uses pre-extracted text (from the upload route)
 * - Audio: downloaded from storage, converted to base64 with format
 *
 * Returns an array of ContentPart objects suitable for the OpenRouter
 * chat completions API. The text prompt is always first.
 */
export async function buildMultimodalContent(
  text: string,
  attachments: AdvisorAttachment[],
): Promise<ContentPart[]> {
  const parts: ContentPart[] = [{ type: "text", text }];

  for (const attachment of attachments) {
    if (attachment.type === "image") {
      const buffer = await downloadAttachment(attachment.storagePath);
      if (buffer) {
        const base64 = buffer.toString("base64");
        parts.push({
          type: "image_url",
          image_url: {
            url: `data:${attachment.contentType};base64,${base64}`,
          },
        });
      }
    } else if (attachment.type === "document") {
      const docText =
        attachment.extractedText ??
        "[Document text was not extracted during upload.]";
      parts.push({
        type: "text",
        text: `\n\n--- Document: ${attachment.filename} ---\n${docText}\n--- End of document ---`,
      });
    } else if (attachment.type === "audio") {
      const buffer = await downloadAttachment(attachment.storagePath);
      if (buffer) {
        const base64 = buffer.toString("base64");
        const format =
          AUDIO_FORMAT_MAP[attachment.contentType] ?? "mp3";
        parts.push({
          type: "input_audio",
          input_audio: { data: base64, format },
        });
      }
    }
  }

  return parts;
}

/**
 * Builds a text-only summary of attachments for historical messages.
 * Previous messages in the conversation don't need full multimodal content
 * — a text description is sufficient and much cheaper.
 */
export function summarizeAttachmentsForHistory(
  attachments: AdvisorAttachment[],
): string {
  if (!attachments || attachments.length === 0) return "";

  const summaries: string[] = [];
  for (const a of attachments) {
    if (a.type === "image") {
      summaries.push(`[Attached image: ${a.filename}]`);
    } else if (a.type === "document") {
      const text = a.extractedText
        ? a.extractedText.slice(0, 2000)
        : "[text not extracted]";
      summaries.push(`[Attached document: ${a.filename}]\n${text}`);
    } else if (a.type === "audio") {
      const transcript = a.transcription
        ? a.transcription
        : "[audio transcript not available]";
      summaries.push(`[Attached audio: ${a.filename}]\nTranscript: ${transcript}`);
    }
  }
  return summaries.join("\n");
}

// ---------------------------------------------------------------------------
// Pricing context injection for spreadsheet uploads
// ---------------------------------------------------------------------------

/**
 * Returns true if any attachment is a spreadsheet (.xlsx/.xls).
 */
export function hasSpreadsheetAttachment(
  attachments: AdvisorAttachment[],
): boolean {
  return attachments.some((a) => {
    if (SPREADSHEET_MIME_TYPES.has(a.contentType)) return true;
    const ext = a.filename.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
    return SPREADSHEET_EXTENSIONS.includes(ext);
  });
}

type CurrentPriceRow = {
  id: number;
  description: string | null;
  price: number | null;
  dimensions: string | null;
  category: string | null;
};

/**
 * Fetches current pricing from both hds_prices and hds_prices_william tables
 * and returns a text block that can be injected into the user message so the
 * AI model can diff the uploaded spreadsheet against current prices.
 *
 * Returns null if the fetch fails or no prices are found.
 */
export async function fetchCurrentPricingForDiff(): Promise<string | null> {
  const admin = createAdminClient();

  const [defaultRes, williamRes] = await Promise.all([
    admin
      .from("hds_prices")
      .select("id,description,price,dimensions,category")
      .order("id", { ascending: true })
      .limit(500),
    admin
      .from("hds_prices_william")
      .select("id,description,price,dimensions,category")
      .order("id", { ascending: true })
      .limit(500),
  ]);

  const lines: string[] = [];

  if (defaultRes.data && defaultRes.data.length > 0) {
    lines.push("=== CURRENT PRICES (hds_prices — used by web app and old chatbot) ===");
    for (const row of defaultRes.data as CurrentPriceRow[]) {
      lines.push(
        `ID:${row.id}\t${row.description ?? ""}\tR${row.price ?? 0}\t${row.dimensions ?? ""}\t${row.category ?? ""}`,
      );
    }
  }

  if (williamRes.data && williamRes.data.length > 0) {
    lines.push("");
    lines.push("=== CURRENT PRICES (hds_prices_william — used by William WhatsApp bot) ===");
    for (const row of williamRes.data as CurrentPriceRow[]) {
      lines.push(
        `ID:${row.id}\t${row.description ?? ""}\tR${row.price ?? 0}\t${row.dimensions ?? ""}\t${row.category ?? ""}`,
      );
    }
  }

  if (lines.length === 0) return null;
  return lines.join("\n");
}
