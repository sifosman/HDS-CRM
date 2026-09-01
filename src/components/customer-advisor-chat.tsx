"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, ClipboardList, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type {
  AdvisorMessage,
  AdvisorChangeRequest,
} from "@/lib/types";
import { stripChangeRequestBlock } from "@/lib/ai-training/change-request-parser";
import {
  ChangeRequestDetailDialog,
  PRIORITY_COLORS,
} from "@/components/ai-training/change-request-detail-dialog";
import {
  retryNotificationAction,
  updateChangeRequestStatusAction,
  deleteChangeRequestAction,
} from "@/app/(authenticated)/ai-training/actions";

type CustomerAdvisorChatProps = {
  customerPhone: string;
  customerName: string | null;
  initialMessages: AdvisorMessage[];
  initialChangeRequests: AdvisorChangeRequest[];
  currentUserId: string;
  ownerNames: Record<string, string>;
};

export function CustomerAdvisorChat({
  customerPhone,
  customerName,
  initialMessages,
  initialChangeRequests,
  currentUserId,
  ownerNames,
}: CustomerAdvisorChatProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<AdvisorMessage[]>(initialMessages);
  const [changeRequests, setChangeRequests] =
    useState<AdvisorChangeRequest[]>(initialChangeRequests);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toolCallNote, setToolCallNote] = useState<string | null>(null);
  const [selectedChangeRequest, setSelectedChangeRequest] =
    useState<AdvisorChangeRequest | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamingTextRef = useRef("");

  // Auto-scroll to the bottom when messages or streaming text change.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streamingText, isStreaming]);

  async function sendMessage() {
    const userMessage = input.trim();
    if (!userMessage || isStreaming) return;

    setInput("");
    setError(null);
    setToolCallNote(null);
    setIsStreaming(true);
    streamingTextRef.current = "";

    // Optimistically add the user message.
    const tempUserMsg: AdvisorMessage = {
      id: `temp-${Date.now()}`,
      session_id: "",
      owner_id: currentUserId,
      role: "user",
      content: userMessage,
      model_id: null,
      context_snapshot_id: null,
      tokens_input: null,
      tokens_output: null,
      cost_usd: null,
      metadata: {},
      attachments: [],
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    abortRef.current = new AbortController();

    try {
      const response = await fetch("/api/ai-training/customer-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerPhone, message: userMessage }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? `Request failed: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let assistantMessageId: string | null = null;
      let cleanedFinalText: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            const data = line.slice(6);
            try {
              const parsed = JSON.parse(data);
              if (currentEvent === "token") {
                const nextChunk = streamingTextRef.current + parsed.token;
                streamingTextRef.current = nextChunk;
                setStreamingText(stripChangeRequestBlock(nextChunk));
                if (toolCallNote) setToolCallNote(null);
              } else if (currentEvent === "tool_call") {
                const toolLabels: Record<string, string> = {
                  search_customers: "Looking up customers...",
                  get_customer_conversations: "Reading conversation history...",
                  get_customer_quotes: "Looking up quotes...",
                };
                setToolCallNote(toolLabels[parsed.tool] ?? "Looking up data...");
              } else if (currentEvent === "done") {
                assistantMessageId = parsed.assistantMessageId;
                if (typeof parsed.cleanedText === "string") {
                  cleanedFinalText = parsed.cleanedText;
                }
                if (parsed.changeRequest) {
                  setChangeRequests((prev) =>
                    prev.some((cr) => cr.id === parsed.changeRequest.id)
                      ? prev
                      : [parsed.changeRequest, ...prev],
                  );
                }
              } else if (currentEvent === "change_request") {
                if (parsed.changeRequest) {
                  setChangeRequests((prev) =>
                    prev.some((cr) => cr.id === parsed.changeRequest.id)
                      ? prev
                      : [parsed.changeRequest, ...prev],
                  );
                }
              } else if (currentEvent === "error") {
                throw new Error(parsed.error);
              }
            } catch (e) {
              if (e instanceof Error && e.message !== "Unexpected token") {
                if (currentEvent === "error") throw e;
              }
            }
          }
        }
      }

      const finalText = cleanedFinalText ?? streamingTextRef.current;
      if (finalText || assistantMessageId) {
        const tempAssistantMsg: AdvisorMessage = {
          id: assistantMessageId ?? `temp-assistant-${Date.now()}`,
          session_id: "",
          owner_id: currentUserId,
          role: "assistant",
          content: finalText,
          model_id: null,
          context_snapshot_id: null,
          tokens_input: null,
          tokens_output: null,
          cost_usd: null,
          metadata: {},
          attachments: [],
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, tempAssistantMsg]);
      }

      router.refresh();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        const partialText = streamingTextRef.current;
        if (partialText) {
          setMessages((prev) => [
            ...prev,
            {
              id: `temp-assistant-${Date.now()}`,
              session_id: "",
              owner_id: currentUserId,
              role: "assistant",
              content: partialText + " [stopped]",
              model_id: null,
              context_snapshot_id: null,
              tokens_input: null,
              tokens_output: null,
              cost_usd: null,
              metadata: {},
              attachments: [],
              created_at: new Date().toISOString(),
            },
          ]);
        }
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    } finally {
      setIsStreaming(false);
      setStreamingText("");
      setToolCallNote(null);
      streamingTextRef.current = "";
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // Map message id → change requests filed from that message, so we can show
  // an inline pill inside the assistant bubble that produced the request.
  const requestsBySourceMsg = new Map<string, AdvisorChangeRequest[]>();
  for (const cr of changeRequests) {
    if (cr.source_message_id) {
      const arr = requestsBySourceMsg.get(cr.source_message_id) ?? [];
      arr.push(cr);
      requestsBySourceMsg.set(cr.source_message_id, arr);
    }
  }

  return (
    <div className="flex flex-col rounded-lg border">
      {/* Header */}
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">AI Advisor Chat</p>
            <p className="text-xs text-muted-foreground">
              Discuss {customerName ?? "this customer"}&rsquo;s WhatsApp
              conversation with the AI advisor. Change requests are filed for
              the dev team.
            </p>
          </div>
        </div>
      </div>

      {/* Message area */}
      <div
        ref={scrollRef}
        className="min-h-[200px] max-h-[400px] overflow-y-auto px-4 py-4 space-y-3 bg-muted/20"
      >
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-[200px] text-center text-sm text-muted-foreground">
            <p>
              Ask about this customer&rsquo;s conversation. For example:
              &ldquo;How could the bot have handled this quote better?&rdquo;
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.role === "user";
          const senderName = ownerNames[msg.owner_id] ?? "Unknown";
          const senderLabel = isUser ? senderName : "AI";
          const filedRequests = !isUser
            ? requestsBySourceMsg.get(msg.id) ?? []
            : [];

          return (
            <div key={msg.id}>
              <div
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-3 ${
                    isUser
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted border"
                  }`}
                >
                  {isUser && (
                    <div className="mb-1 text-xs font-medium opacity-80">
                      {senderLabel}
                    </div>
                  )}
                  <div className="whitespace-pre-wrap text-sm leading-relaxed break-words">
                    {msg.content}
                  </div>
                  {filedRequests.map((cr) => (
                    <button
                      key={cr.id}
                      onClick={() => setSelectedChangeRequest(cr)}
                      className="mt-3 flex w-full items-center gap-2 rounded-md border bg-background/60 px-3 py-2 text-left text-xs hover:bg-background transition-colors"
                    >
                      <ClipboardList className="h-4 w-4 shrink-0 text-primary" />
                      <span className="flex-1 truncate font-medium">
                        {cr.title}
                      </span>
                      <Badge
                        className={`${PRIORITY_COLORS[cr.priority] ?? ""} capitalize gap-1`}
                      >
                        <AlertTriangle className="h-3 w-3" />
                        {cr.priority}
                      </Badge>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}

        {/* Streaming assistant bubble */}
        {isStreaming && (
          <>
            {streamingText ? (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-lg px-4 py-3 bg-muted border">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed break-words">
                    {streamingText}
                    <span
                      className="inline-block w-2 h-4 ml-1 align-text-bottom bg-current animate-pulse"
                      aria-hidden
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-lg px-4 py-3 bg-muted border">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>
                      {toolCallNote ?? "AI is thinking"}
                    </span>
                    {!toolCallNote && (
                      <span className="inline-flex gap-1" aria-hidden>
                        <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-1 h-1 rounded-full bg-current animate-bounce" />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {error && (
          <div className="flex justify-center">
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this customer's chat..."
            className="min-h-[44px] max-h-32 resize-none text-sm"
            rows={1}
            disabled={isStreaming}
          />
          <Button
            size="icon"
            onClick={sendMessage}
            disabled={!input.trim() || isStreaming}
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Enter to send, Shift+Enter for a new line.
        </p>
      </div>

      {/* Change request detail dialog */}
      {selectedChangeRequest && (
        <ChangeRequestDetailDialog
          request={selectedChangeRequest}
          ownerName={ownerNames[selectedChangeRequest.owner_id]}
          onClose={() => setSelectedChangeRequest(null)}
          onStatusChange={(status) => {
            updateChangeRequestStatusAction(selectedChangeRequest.id, status).then(
              (r) => {
                if (r.ok) {
                  setChangeRequests((prev) =>
                    prev.map((cr) =>
                      cr.id === selectedChangeRequest.id
                        ? { ...cr, status }
                        : cr,
                    ),
                  );
                  setSelectedChangeRequest((prev) =>
                    prev ? { ...prev, status } : prev,
                  );
                }
              },
            );
          }}
          onRetry={() => {
            retryNotificationAction(selectedChangeRequest.id).then((r) => {
              if (r.ok) {
                setChangeRequests((prev) =>
                  prev.map((cr) =>
                    cr.id === selectedChangeRequest.id ? r.data : cr,
                  ),
                );
                setSelectedChangeRequest(r.data);
              }
            });
          }}
          onDelete={() => {
            deleteChangeRequestAction(selectedChangeRequest.id).then((r) => {
              if (r.ok) {
                setChangeRequests((prev) =>
                  prev.filter((cr) => cr.id !== selectedChangeRequest.id),
                );
                setSelectedChangeRequest(null);
              }
            });
          }}
        />
      )}
    </div>
  );
}
