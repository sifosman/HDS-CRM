import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { chatRequestSchema } from "@/lib/ai-training/validation";
import { isValidAdvisorModel } from "@/lib/ai-training/models";
import {
  assembleContext,
  getOrCreateSnapshot,
  buildSystemInstruction,
} from "@/lib/ai-training/context";
import { streamChatCompletion, type ChatMessage } from "@/lib/ai-training/openrouter";
import type { AdvisorChangeRequest, AdvisorAttachment, AdvisorModelId } from "@/lib/types";
import {
  persistUserMessage,
  persistAssistantMessage,
  autoGenerateTitle,
  getAdvisorMessages,
  createChangeRequestRecord,
} from "@/app/(authenticated)/ai-training/actions";
import { parseChangeRequestBlock } from "@/lib/ai-training/change-request-parser";
import {
  resolveModelForAttachments,
  buildMultimodalContent,
  summarizeAttachmentsForHistory,
} from "@/lib/ai-training/attachments";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  // Auth: owner-only. The proxy treats /api/* as public, so we must enforce
  // the owner role here explicitly.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (user.role !== "owner" && user.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const { sessionId, message, model, attachments } = parsed.data;

  // Verify the session belongs to this owner
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("ai_training_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Determine the model: use the request model, or the session's default
  const selectedModelRaw = model ?? session.selected_model;
  if (!isValidAdvisorModel(selectedModelRaw)) {
    return NextResponse.json({ error: "Invalid model" }, { status: 400 });
  }

  // Auto-switch model if attachments require capabilities the selected model
  // doesn't have (e.g. audio → Gemini 3.7 Flash).
  const attachmentList = (attachments ?? []) as AdvisorAttachment[];
  const { model: effectiveModel, switched, reason: modelSwitchReason } =
    resolveModelForAttachments(selectedModelRaw as AdvisorModelId, attachmentList);

  // Persist the user message (with attachments)
  const userMessage = await persistUserMessage(
    sessionId,
    user.id,
    message,
    attachmentList,
  );
  if (!userMessage) {
    return NextResponse.json(
      { error: "Failed to persist message" },
      { status: 500 },
    );
  }

  // Auto-generate title if this is the first message
  const existingMessages = await getAdvisorMessages(sessionId);
  if (existingMessages.length <= 1) {
    await autoGenerateTitle(sessionId, message);
  }

  // Assemble sanitized context
  const context = await assembleContext();
  const snapshotId = await getOrCreateSnapshot(context);
  const systemInstruction = buildSystemInstruction(context);

  // Build the message history for OpenRouter (token-budgeted)
  const history: ChatMessage[] = [{ role: "system", content: systemInstruction }];

  // Send recent messages (last 20 to stay within token budget).
  // For historical messages, use text-only content with attachment summaries
  // to avoid re-downloading and re-encoding files from storage.
  const recentMessages = existingMessages.slice(-20);
  for (const msg of recentMessages) {
    if (msg.role === "user" || msg.role === "assistant") {
      const attachmentSummary = summarizeAttachmentsForHistory(
        (msg.attachments ?? []) as AdvisorAttachment[],
      );
      const textContent = attachmentSummary
        ? `${msg.content}\n\n${attachmentSummary}`
        : msg.content;
      history.push({
        role: msg.role,
        content: textContent,
      });
    }
  }

  // Replace the last user message with multimodal content (images/audio as
  // base64 content parts, documents as extracted text).
  if (attachmentList.length > 0 && history.length > 0) {
    const lastIdx = history.length - 1;
    const lastMsg = history[lastIdx];
    if (lastMsg.role === "user" && typeof lastMsg.content === "string") {
      // The last user message text is the original `message` (without the
      // attachment summary that was just added). Rebuild with multimodal.
      const multimodalContent = await buildMultimodalContent(
        message,
        attachmentList,
      );
      history[lastIdx] = {
        role: "user",
        content: multimodalContent,
      };
    }
  }

  // Stream the response
  const encoder = new TextEncoder();
  const abortController = new AbortController();

  const stream = new ReadableStream({
    async start(controller) {
      let fullText = "";
      let usage: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
        cost?: number;
      } | null = null as { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; cost?: number } | null;
      let responseModel: string = effectiveModel;

      const sendEvent = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      // Send initial metadata
      sendEvent("meta", {
        sessionId,
        model: effectiveModel,
        selectedModel: selectedModelRaw,
        modelSwitched: switched,
        modelSwitchReason: modelSwitchReason ?? undefined,
        contextStale: context.isStale,
        contextTimestamp: context.sourceTimestamps,
        userMessageId: userMessage.id,
      });

      await streamChatCompletion(
        {
          model: effectiveModel,
          messages: history,
          signal: abortController.signal,
        },
        {
          onToken: (token) => {
            sendEvent("token", { token });
            fullText += token;
          },
          onDone: (result) => {
            fullText = result.fullText || fullText;
            usage = result.usage;
            responseModel = result.model;
          },
          onError: (error) => {
            sendEvent("error", { error: error.message });
            controller.close();
          },
        },
      );

      // Check for an auto-filed change request block emitted by the model.
      // The block is stripped from the persisted/displayed message and a real
      // change request record is created so it appears in the sidebar.
      let assistantMessageId: string | null = null;
      let changeRequestCreated: AdvisorChangeRequest | null = null;
      const parsed = fullText.length > 0 ? parseChangeRequestBlock(fullText) : null;
      const textToPersist = parsed ? parsed.cleanedText : fullText;

      // Persist the assistant message (with the JSON block stripped, if any)
      if (textToPersist.length > 0) {
        const assistantMessage = await persistAssistantMessage(
          sessionId,
          user.id,
          textToPersist,
          {
            modelId: responseModel,
            contextSnapshotId: snapshotId ?? undefined,
            tokensInput: usage?.prompt_tokens,
            tokensOutput: usage?.completion_tokens,
            costUsd: usage?.cost,
          },
        );

        assistantMessageId = assistantMessage?.id ?? null;
      }

      // Auto-create the change request from the parsed block
      if (parsed) {
        const result = await createChangeRequestRecord(user, {
          sessionId,
          sourceMessageId: assistantMessageId ?? undefined,
          modelId: responseModel,
          contextSnapshotId: snapshotId ?? undefined,
          title: parsed.draft.title,
          currentBehavior: parsed.draft.current_behavior,
          requestedBehavior: parsed.draft.requested_behavior,
          rationale: parsed.draft.rationale,
          examples: parsed.draft.examples,
          affectedAreas: parsed.draft.affected_areas,
          priority: parsed.draft.priority,
          risks: parsed.draft.risks,
          acceptanceCriteria: parsed.draft.acceptance_criteria,
        });
        if (result.ok) {
          changeRequestCreated = result.data;
        }
      }

      const doneData: Record<string, unknown> = {
        assistantMessageId,
        usage,
        model: responseModel,
        cleanedText: parsed ? parsed.cleanedText : undefined,
      };
      if (changeRequestCreated) {
        doneData.changeRequest = changeRequestCreated;
        // Also emit a dedicated event so the frontend can populate the sidebar
        // even if it misses the done payload.
        sendEvent("change_request", { changeRequest: changeRequestCreated });
      }

      sendEvent("done", doneData);

      controller.close();
    },
    cancel() {
      abortController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
