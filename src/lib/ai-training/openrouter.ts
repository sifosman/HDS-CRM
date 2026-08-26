import type { AdvisorModelId } from "@/lib/types";
import { getAdvisorModel } from "./models";

/**
 * Server-only OpenRouter client. The API key is read from the
 * OPENROUTER_API_KEY environment variable and never sent to the browser.
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "input_audio"; input_audio: { data: string; format: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
};

export type OpenRouterUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  cost?: number;
} | null;

export type StreamCallbacks = {
  onToken: (token: string) => void;
  onDone: (result: {
    fullText: string;
    usage: OpenRouterUsage;
    model: string;
  }) => void;
  onError: (error: Error) => void;
};

export type ChatCompletionOptions = {
  model: AdvisorModelId;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
};

/**
 * Streams a chat completion from OpenRouter. Calls `onToken` for each
 * incremental text chunk, then `onDone` with the full text and usage data.
 */
export async function streamChatCompletion(
  options: ChatCompletionOptions,
  callbacks: StreamCallbacks,
): Promise<void> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    callbacks.onError(new Error("OpenRouter API key is not configured"));
    return;
  }

  const modelConfig = getAdvisorModel(options.model);
  if (!modelConfig) {
    callbacks.onError(new Error("Invalid model"));
    return;
  }

  const maxTokens = options.maxTokens ?? modelConfig.defaultMaxTokens;

  let response: Response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://hds-crm-dashboard",
        "X-Title": "HDS AI Training Advisor",
      },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        max_tokens: maxTokens,
        temperature: options.temperature ?? 0.7,
        stream: true,
        usage: { include: true },
      }),
      signal: options.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return;
    }
    callbacks.onError(
      err instanceof Error ? err : new Error("OpenRouter request failed"),
    );
    return;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    callbacks.onError(
      new Error(
        `OpenRouter error ${response.status}: ${body.slice(0, 200) || response.statusText}`,
      ),
    );
    return;
  }

  if (!response.body) {
    callbacks.onError(new Error("OpenRouter returned no response body"));
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  let usage: OpenRouterUsage = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;
        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (typeof delta === "string" && delta.length > 0) {
            fullText += delta;
            callbacks.onToken(delta);
          }
          if (parsed.usage) {
            usage = {
              prompt_tokens: parsed.usage.prompt_tokens,
              completion_tokens: parsed.usage.completion_tokens,
              total_tokens: parsed.usage.total_tokens,
              cost: parsed.usage.cost,
            };
          }
        } catch {
          // Skip malformed SSE chunks
        }
      }
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      callbacks.onDone({ fullText, usage, model: options.model });
      return;
    }
    callbacks.onError(
      err instanceof Error ? err : new Error("Stream read failed"),
    );
    return;
  }

  callbacks.onDone({ fullText, usage, model: options.model });
}

/**
 * Non-streaming completion for structured tool calls (e.g. change-request
 * draft generation). Returns the full text and usage.
 */
export async function chatCompletion(
  options: ChatCompletionOptions,
): Promise<{ text: string; usage: OpenRouterUsage; model: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OpenRouter API key is not configured");

  const modelConfig = getAdvisorModel(options.model);
  if (!modelConfig) throw new Error("Invalid model");

  const maxTokens = options.maxTokens ?? modelConfig.defaultMaxTokens;

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://hds-crm-dashboard",
      "X-Title": "HDS AI Training Advisor",
    },
    body: JSON.stringify({
      model: options.model,
      messages: options.messages,
      max_tokens: maxTokens,
      temperature: options.temperature ?? 0.4,
      stream: false,
      response_format: { type: "json_object" },
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `OpenRouter error ${response.status}: ${body.slice(0, 200) || response.statusText}`,
    );
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  const usage: OpenRouterUsage = data.usage
    ? {
        prompt_tokens: data.usage.prompt_tokens,
        completion_tokens: data.usage.completion_tokens,
        total_tokens: data.usage.total_tokens,
        cost: data.usage.cost,
      }
    : null;

  return { text, usage, model: options.model };
}
