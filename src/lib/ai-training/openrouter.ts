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

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | ContentPart[] | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
};

export type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
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
  onToolCall?: (toolName: string, toolArgs: Record<string, unknown>) => void;
};

export type ChatCompletionOptions = {
  model: AdvisorModelId;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  tools?: ToolDefinition[];
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

// ---------------------------------------------------------------------------
// Tool-calling streaming (agentic loop)
// ---------------------------------------------------------------------------

type ToolExecutor = (
  toolName: string,
  args: Record<string, unknown>,
) => Promise<string>;

/**
 * Streams a chat completion with tool-calling support. When the model
 * requests a tool call, the stream pauses, the tool is executed, and the
 * result is appended to the conversation. The model then continues with
 * the tool results, producing its final answer (which streams to the client).
 *
 * The agentic loop runs at most `maxToolRounds` times (default 3) to prevent
 * infinite tool calling.
 */
export async function streamChatWithTools(
  options: ChatCompletionOptions,
  callbacks: StreamCallbacks,
  executeTool: ToolExecutor,
  maxToolRounds = 3,
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
  const messages = [...options.messages];
  let round = 0;

  while (round <= maxToolRounds) {
    round++;

    let response: Response;
    try {
      const requestBody: Record<string, unknown> = {
        model: options.model,
        messages,
        max_tokens: maxTokens,
        temperature: options.temperature ?? 0.7,
        stream: true,
        usage: { include: true },
      };
      if (options.tools && options.tools.length > 0) {
        requestBody.tools = options.tools;
        requestBody.tool_choice = "auto";
      }
      response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://hds-crm-dashboard",
          "X-Title": "HDS AI Training Advisor",
        },
        body: JSON.stringify(requestBody),
        signal: options.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
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

    // Parse the SSE stream, accumulating text and tool calls
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";
    let usage: OpenRouterUsage = null;
    let finishReason: string | null = null;
    // Tool calls arrive as deltas — accumulate by index
    const toolCallAccumulator: Map<number, { id: string; name: string; args: string }> =
      new Map();

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
            const choice = parsed.choices?.[0];
            const delta = choice?.delta;

            // Text content
            if (typeof delta?.content === "string" && delta.content.length > 0) {
              fullText += delta.content;
              callbacks.onToken(delta.content);
            }

            // Tool call deltas (accumulate by index)
            if (delta?.tool_calls && Array.isArray(delta.tool_calls)) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                const existing = toolCallAccumulator.get(idx) ?? {
                  id: "",
                  name: "",
                  args: "",
                };
                if (tc.id) existing.id = tc.id;
                if (tc.function?.name) existing.name += tc.function.name;
                if (tc.function?.arguments) existing.args += tc.function.arguments;
                toolCallAccumulator.set(idx, existing);
              }
            }

            if (choice?.finish_reason) {
              finishReason = choice.finish_reason;
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

    // If the model didn't request any tools, we're done
    if (finishReason !== "tool_calls" || toolCallAccumulator.size === 0) {
      callbacks.onDone({ fullText, usage, model: options.model });
      return;
    }

    // --- Tool call round ---
    // Add the assistant message (with tool_calls) to the conversation
    const toolCalls: ToolCall[] = [];
    for (const [, tc] of toolCallAccumulator) {
      if (tc.name) {
        toolCalls.push({
          id: tc.id || `call_${round}_${tc.name}`,
          type: "function",
          function: { name: tc.name, arguments: tc.args || "{}" },
        });
      }
    }

    if (toolCalls.length === 0) {
      callbacks.onDone({ fullText, usage, model: options.model });
      return;
    }

    messages.push({
      role: "assistant",
      content: fullText || null,
      tool_calls: toolCalls,
    });

    // Execute each tool call and append the result
    for (const tc of toolCalls) {
      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs = JSON.parse(tc.function.arguments);
      } catch {
        parsedArgs = {};
      }

      // Notify the client that a tool is being called
      callbacks.onToolCall?.(tc.function.name, parsedArgs);

      const result = await executeTool(tc.function.name, parsedArgs);
      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: result,
      });
    }

    // Loop again — the model will now see the tool results and generate
    // its final answer (which will stream to the client).
    // Don't send tools on subsequent rounds to prevent infinite tool calling
    // after the first round — the model has the data it needs.
    if (round >= maxToolRounds) {
      // Last allowed round — force the model to answer without tools
      options.tools = undefined;
    }
  }

  // If we exhausted all rounds, the last onDone was already called.
  // If not, call it with whatever we have.
  callbacks.onDone({ fullText: "", usage: null, model: options.model });
}
