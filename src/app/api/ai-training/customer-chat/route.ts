import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { customerChatRequestSchema } from "@/lib/ai-training/validation";
import { DEFAULT_ADVISOR_MODEL } from "@/lib/ai-training/models";
import { buildCustomerSystemInstruction } from "@/lib/ai-training/context";
import { streamChatWithTools, type ChatMessage } from "@/lib/ai-training/openrouter";
import { customerToolDefinitions, executeCustomerTool } from "@/lib/ai-training/customer-tools";
import type { AdvisorChangeRequest } from "@/lib/types";
import {
  persistUserMessage,
  persistAssistantMessage,
  getAdvisorMessages,
  getOrCreateCustomerSessionAction,
  createChangeRequestRecord,
} from "@/app/(authenticated)/ai-training/actions";
import { parseChangeRequestBlock } from "@/lib/ai-training/change-request-parser";
import { getConversationsByPhone } from "@/lib/queries";
import type { CustomerProfile } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  // Auth: owner or manager only. The proxy treats /api/* as public, so we
  // enforce the role here explicitly.
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

  const parsed = customerChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const { customerPhone, message } = parsed.data;

  // Fetch the customer profile + WhatsApp conversations so we can inject them
  // into the system prompt. The customer must exist.
  const supabase = await createClient();
  const normalized = customerPhone.replace(/^\+/, "");
  const { data: customerRow } = await supabase
    .from("customer_profiles")
    .select("*")
    .or(`phone_number.eq.${normalized},phone_number.eq.+${normalized}`)
    .maybeSingle();

  if (!customerRow) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const customer = customerRow as CustomerProfile;
  const conversations = await getConversationsByPhone(normalized, 100);

  // Resolve (or create) the shared per-customer session.
  const sessionResult = await getOrCreateCustomerSessionAction(
    normalized,
    customer.name,
  );
  if (!sessionResult.ok) {
    return NextResponse.json({ error: sessionResult.error }, { status: 500 });
  }
  const session = sessionResult.data;

  // Persist the user message.
  const userMessage = await persistUserMessage(session.id, user.id, message);
  if (!userMessage) {
    return NextResponse.json({ error: "Failed to persist message" }, { status: 500 });
  }

  // Build the customer-scoped system instruction.
  const systemInstruction = buildCustomerSystemInstruction(customer, conversations);

  // Build the message history for OpenRouter (token-budgeted).
  const existingMessages = await getAdvisorMessages(session.id);
  const history: ChatMessage[] = [{ role: "system", content: systemInstruction }];

  const recentMessages = existingMessages.slice(-20);
  for (const msg of recentMessages) {
    if (msg.role === "user" || msg.role === "assistant") {
      history.push({ role: msg.role, content: msg.content });
    }
  }

  // Stream the response.
  const encoder = new TextEncoder();
  const abortController = new AbortController();
  const effectiveModel = DEFAULT_ADVISOR_MODEL;

  const stream = new ReadableStream({
    async start(controller) {
      let fullText = "";
      let usage: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
        cost?: number;
      } | null = null as {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
        cost?: number;
      } | null;
      let responseModel: string = effectiveModel;

      const sendEvent = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      sendEvent("meta", {
        sessionId: session.id,
        model: effectiveModel,
        userMessageId: userMessage.id,
      });

      await streamChatWithTools(
        {
          model: effectiveModel,
          messages: history,
          signal: abortController.signal,
          tools: customerToolDefinitions,
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
          onToolCall: (toolName, toolArgs) => {
            sendEvent("tool_call", { tool: toolName, args: toolArgs });
          },
        },
        executeCustomerTool,
      );

      // Parse + strip any auto-filed change request block.
      let assistantMessageId: string | null = null;
      let changeRequestCreated: AdvisorChangeRequest | null = null;
      const parsedBlock = fullText.length > 0 ? parseChangeRequestBlock(fullText) : null;
      const textToPersist = parsedBlock ? parsedBlock.cleanedText : fullText;

      if (textToPersist.length > 0) {
        const assistantMessage = await persistAssistantMessage(
          session.id,
          user.id,
          textToPersist,
          {
            modelId: responseModel,
            tokensInput: usage?.prompt_tokens,
            tokensOutput: usage?.completion_tokens,
            costUsd: usage?.cost,
          },
        );
        assistantMessageId = assistantMessage?.id ?? null;
      }

      if (parsedBlock) {
        const result = await createChangeRequestRecord(user, {
          sessionId: session.id,
          sourceMessageId: assistantMessageId ?? undefined,
          modelId: responseModel,
          title: parsedBlock.draft.title,
          currentBehavior: parsedBlock.draft.current_behavior,
          requestedBehavior: parsedBlock.draft.requested_behavior,
          rationale: parsedBlock.draft.rationale,
          examples: parsedBlock.draft.examples,
          affectedAreas: parsedBlock.draft.affected_areas,
          priority: parsedBlock.draft.priority,
          risks: parsedBlock.draft.risks,
          acceptanceCriteria: parsedBlock.draft.acceptance_criteria,
        });
        if (result.ok) {
          changeRequestCreated = result.data;
        }
      }

      const doneData: Record<string, unknown> = {
        assistantMessageId,
        usage,
        model: responseModel,
        cleanedText: parsedBlock ? parsedBlock.cleanedText : undefined,
      };
      if (changeRequestCreated) {
        doneData.changeRequest = changeRequestCreated;
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
