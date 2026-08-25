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
import {
  persistUserMessage,
  persistAssistantMessage,
  autoGenerateTitle,
  getAdvisorMessages,
} from "@/app/(authenticated)/ai-training/actions";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  // Auth: owner-only. The proxy treats /api/* as public, so we must enforce
  // the owner role here explicitly.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (user.role !== "owner") {
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

  const { sessionId, message, model } = parsed.data;

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
  const selectedModel = selectedModelRaw;

  // Persist the user message
  const userMessage = await persistUserMessage(sessionId, user.id, message);
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

  // Send recent messages (last 20 to stay within token budget)
  const recentMessages = existingMessages.slice(-20);
  for (const msg of recentMessages) {
    if (msg.role === "user" || msg.role === "assistant") {
      history.push({
        role: msg.role,
        content: msg.content,
      });
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
      let responseModel: string = selectedModel;

      const sendEvent = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      // Send initial metadata
      sendEvent("meta", {
        sessionId,
        model: selectedModel,
        contextStale: context.isStale,
        contextTimestamp: context.sourceTimestamps,
        userMessageId: userMessage.id,
      });

      await streamChatCompletion(
        {
          model: selectedModel,
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

      // Persist the assistant message
      if (fullText.length > 0) {
        const assistantMessage = await persistAssistantMessage(
          sessionId,
          user.id,
          fullText,
          {
            modelId: responseModel,
            contextSnapshotId: snapshotId ?? undefined,
            tokensInput: usage?.prompt_tokens,
            tokensOutput: usage?.completion_tokens,
            costUsd: usage?.cost,
          },
        );

        sendEvent("done", {
          assistantMessageId: assistantMessage?.id ?? null,
          usage,
          model: responseModel,
        });
      } else {
        sendEvent("done", { assistantMessageId: null, usage, model: responseModel });
      }

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
