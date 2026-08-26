import { createAdminClient } from "@/lib/supabase/admin";
import type { AdvisorAttachment, AdvisorModelId } from "@/lib/types";
import {
  getAdvisorModel,
  AUDIO_FALLBACK_MODEL,
  VISION_FALLBACK_MODEL,
} from "./models";
import type { ContentPart } from "./openrouter";

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
