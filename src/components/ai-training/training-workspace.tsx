"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, Square, Plus, MessageSquare, Archive, Trash2, Pencil, Check, X, AlertCircle, Mail, Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type {
  AdvisorSession,
  AdvisorMessage,
  AdvisorChangeRequest,
  AdvisorModelId,
  AdvisorChangeRequestPriority,
} from "@/lib/types";
import { getPublicAdvisorModels } from "@/lib/ai-training/models";
import {
  createSessionAction,
  renameSessionAction,
  archiveSessionAction,
  deleteSessionAction,
  updateSessionModelAction,
  createChangeRequestAction,
  retryNotificationAction,
  updateChangeRequestStatusAction,
} from "@/app/(authenticated)/ai-training/actions";

const MODELS = getPublicAdvisorModels();

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-blue-100 text-blue-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-800",
  in_review: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  implemented: "bg-purple-100 text-purple-800",
  rejected: "bg-red-100 text-red-800",
};

const NOTIFICATION_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  sent: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

type TrainingWorkspaceProps = {
  sessions: AdvisorSession[];
  currentSession: AdvisorSession | null;
  messages: AdvisorMessage[];
  changeRequests: AdvisorChangeRequest[];
  contextInfo: { isStale: boolean; timestamps: Record<string, string> } | null;
};

export function TrainingWorkspace({
  sessions: initialSessions,
  currentSession,
  messages: initialMessages,
  changeRequests: initialChangeRequests,
  contextInfo,
}: TrainingWorkspaceProps) {
  const router = useRouter();
  const [sessions, setSessions] = useState(initialSessions);
  const [messages, setMessages] = useState(initialMessages);
  const [changeRequests, setChangeRequests] = useState(initialChangeRequests);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(currentSession?.title ?? "");
  const [showChangeRequestDialog, setShowChangeRequestDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamingTextRef = useRef("");

  // Sync state when session changes (navigation).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessages(initialMessages);
    setTitleValue(currentSession?.title ?? "");
    setError(null);
    setStreamingText("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSession?.id]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingText]);

  const handleNewChat = async () => {
    setIsCreatingChat(true);
    setError(null);
    try {
      const result = await createSessionAction({});
      if (result.ok) {
        router.push(`/ai-training/${result.data.id}`);
      } else {
        setError(result.error);
        setIsCreatingChat(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create chat");
      setIsCreatingChat(false);
    }
  };

  const handleRename = async () => {
    if (!currentSession || !titleValue.trim()) return;
    const result = await renameSessionAction(currentSession.id, titleValue.trim());
    if (result.ok) {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentSession.id ? { ...s, title: titleValue.trim() } : s,
        ),
      );
      setEditingTitle(false);
    } else {
      setError(result.error);
    }
  };

  const handleArchive = async () => {
    if (!currentSession) return;
    const result = await archiveSessionAction(currentSession.id, true);
    if (result.ok) {
      setSessions((prev) => prev.filter((s) => s.id !== currentSession.id));
      router.push("/ai-training");
    } else {
      setError(result.error);
    }
  };

  const handleDelete = async () => {
    if (!currentSession) return;
    const result = await deleteSessionAction(currentSession.id);
    if (result.ok) {
      setSessions((prev) => prev.filter((s) => s.id !== currentSession.id));
      setShowDeleteConfirm(false);
      router.push("/ai-training");
    } else {
      setError(result.error);
    }
  };

  const handleModelChange = async (model: string) => {
    if (!currentSession) return;
    const result = await updateSessionModelAction(currentSession.id, model);
    if (result.ok) {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentSession.id ? { ...s, selected_model: model as AdvisorModelId } : s,
        ),
      );
    } else {
      setError(result.error);
    }
  };

  const handleSend = async () => {
    if (!currentSession || !input.trim() || isStreaming) return;
    const userMessage = input.trim();
    setInput("");
    setError(null);
    setIsStreaming(true);
    setStreamingText("");
    streamingTextRef.current = "";

    // Optimistically add user message
    const tempUserMsg: AdvisorMessage = {
      id: `temp-${Date.now()}`,
      session_id: currentSession.id,
      owner_id: currentSession.owner_id,
      role: "user",
      content: userMessage,
      model_id: null,
      context_snapshot_id: null,
      tokens_input: null,
      tokens_output: null,
      cost_usd: null,
      metadata: {},
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    abortRef.current = new AbortController();

    try {
      const response = await fetch("/api/ai-training/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: currentSession.id,
          message: userMessage,
          model: currentSession.selected_model,
        }),
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
                const nextChunk = (streamingTextRef.current + parsed.token) as string;
                streamingTextRef.current = nextChunk;
                setStreamingText(nextChunk);
              } else if (currentEvent === "done") {
                assistantMessageId = parsed.assistantMessageId;
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

      // Add the assistant message using the ref (not stale state)
      const finalText = streamingTextRef.current;
      if (finalText || assistantMessageId) {
        const tempAssistantMsg: AdvisorMessage = {
          id: assistantMessageId ?? `temp-assistant-${Date.now()}`,
          session_id: currentSession.id,
          owner_id: currentSession.owner_id,
          role: "assistant",
          content: finalText,
          model_id: currentSession.selected_model,
          context_snapshot_id: null,
          tokens_input: null,
          tokens_output: null,
          cost_usd: null,
          metadata: {},
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, tempAssistantMsg]);
      }

      // Refresh to get persisted data from the server
      router.refresh();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        const partialText = streamingTextRef.current;
        if (partialText) {
          const tempAssistantMsg: AdvisorMessage = {
            id: `temp-assistant-${Date.now()}`,
            session_id: currentSession.id,
            owner_id: currentSession.owner_id,
            role: "assistant",
            content: partialText + " [stopped]",
            model_id: currentSession.selected_model,
            context_snapshot_id: null,
            tokens_input: null,
            tokens_output: null,
            cost_usd: null,
            metadata: {},
            created_at: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, tempAssistantMsg]);
        }
      } else {
        setError(err instanceof Error ? err.message : "Failed to send message");
      }
    } finally {
      setIsStreaming(false);
      setStreamingText("");
      streamingTextRef.current = "";
      abortRef.current = null;
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0 -mx-4 -mb-6">
      {/* Session rail */}
      <div className="w-64 border-r flex flex-col bg-muted/30">
        <div className="p-3 border-b">
          <Button onClick={handleNewChat} className="w-full" variant="default" disabled={isCreatingChat}>
            {isCreatingChat ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            New Chat
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {sessions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                No sessions yet. Start a new chat.
              </p>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className={`group flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer hover:bg-muted transition-colors ${
                    currentSession?.id === session.id ? "bg-muted font-medium" : ""
                  }`}
                  onClick={() => router.push(`/ai-training/${session.id}`)}
                >
                  <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate flex-1">{session.title}</span>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Chat panel */}
      <div className="flex-1 flex flex-col relative">
        {isCreatingChat && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Creating new chat...</p>
            </div>
          </div>
        )}
        {/* Header */}
        <div className="border-b px-4 py-3 flex items-center gap-3 flex-wrap">
          {currentSession ? (
            <>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {editingTitle ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={titleValue}
                      onChange={(e) => setTitleValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleRename()}
                      className="h-8 w-64"
                      autoFocus
                    />
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleRename}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingTitle(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <h2
                    className="text-lg font-heading font-bold truncate cursor-pointer hover:text-primary flex items-center gap-2"
                    onClick={() => setEditingTitle(true)}
                  >
                    {currentSession.title}
                    <Pencil className="h-3 w-3 text-muted-foreground" />
                  </h2>
                )}
              </div>

              <Select
                value={currentSession.selected_model}
                onValueChange={(v) => v && handleModelChange(v)}
              >
                <SelectTrigger className="w-48 h-8">
                  <SelectValue placeholder="Model" />
                </SelectTrigger>
                <SelectContent>
                  {MODELS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {contextInfo && (
                <Badge variant={contextInfo.isStale ? "destructive" : "secondary"} className="text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  {contextInfo.isStale ? "Stale context" : "Live context"}
                </Badge>
              )}

              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleArchive} title="Archive">
                <Archive className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setShowDeleteConfirm(true)} title="Delete">
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <h2 className="text-lg font-heading font-bold">AI Training Advisor</h2>
          )}
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
          {!currentSession ? (
            <WelcomeView />
          ) : messages.length === 0 && !isStreaming ? (
            <EmptyChatView />
          ) : (
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {isStreaming && streamingText === "" && (
                <ThinkingBubble modelId={currentSession.selected_model} />
              )}
              {isStreaming && streamingText !== "" && (
                <MessageBubble
                  message={{
                    id: "streaming",
                    session_id: currentSession.id,
                    owner_id: currentSession.owner_id,
                    role: "assistant",
                    content: streamingText,
                    model_id: currentSession.selected_model,
                    context_snapshot_id: null,
                    tokens_input: null,
                    tokens_output: null,
                    cost_usd: null,
                    metadata: {},
                    created_at: new Date().toISOString(),
                  }}
                  isStreaming
                />
              )}
            </div>
          )}
        </div>

        {/* Composer */}
        {currentSession && (
          <div className="border-t px-4 py-3">
            {error && (
              <div className="mb-2 flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
            <div className="flex items-end gap-2 max-w-3xl mx-auto">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about the chatbot, suggest a training improvement, or describe a sales scenario..."
                className="min-h-[44px] max-h-32 resize-none"
                rows={1}
                disabled={isStreaming}
              />
              {isStreaming ? (
                <Button onClick={handleStop} variant="destructive" size="icon">
                  <Square className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  size="icon"
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1 text-center">
              Read-only advisor — no production changes are made automatically.
            </p>
          </div>
        )}
      </div>

      {/* Change requests sidebar */}
      <div className="w-80 border-l flex flex-col bg-muted/30">
        <div className="p-3 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Change Requests</h3>
            {currentSession && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowChangeRequestDialog(true)}
              >
                <Plus className="h-3 w-3 mr-1" />
                New
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-2">
            {changeRequests.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                No change requests yet. Discuss an improvement with the advisor, then create one.
              </p>
            ) : (
              changeRequests.map((req) => (
                <ChangeRequestCard
                  key={req.id}
                  request={req}
                  onRetry={() => retryNotificationAction(req.id).then((r) => {
                    if (r.ok) {
                      setChangeRequests((prev) =>
                        prev.map((cr) => (cr.id === req.id ? r.data : cr)),
                      );
                    }
                  })}
                  onStatusChange={(status) =>
                    updateChangeRequestStatusAction(req.id, status).then((r) => {
                      if (r.ok) {
                        setChangeRequests((prev) =>
                          prev.map((cr) =>
                            cr.id === req.id ? { ...cr, status } : cr,
                          ),
                        );
                      }
                    })
                  }
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Delete confirmation */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete session?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete the session and all its messages. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change request dialog */}
      {showChangeRequestDialog && (
        <ChangeRequestDialog
          sessionId={currentSession?.id}
          onClose={() => setShowChangeRequestDialog(false)}
          onCreated={(req) => {
            setChangeRequests((prev) => [req, ...prev]);
            setShowChangeRequestDialog(false);
          }}
          onError={(err) => setError(err)}
        />
      )}
    </div>
  );
}

function WelcomeView() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="mb-4">
          <MessageSquare className="h-16 w-16 mx-auto text-muted-foreground/40" />
        </div>
        <h2 className="text-2xl font-heading font-bold mb-2">AI Training Advisor</h2>
        <p className="text-muted-foreground mb-6">
          A private workspace where you can discuss how the WhatsApp AI sales chatbot
          should respond and close sales. Suggest improvements, draft change requests,
          and track their status — all without touching production.
        </p>
        <div className="text-left bg-muted/50 rounded-lg p-4 space-y-2">
          <p className="text-sm font-medium">You can:</p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Ask how the chatbot currently handles a sales scenario</li>
            <li>Suggest better responses based on your sales experience</li>
            <li>Create structured change requests for review</li>
            <li>Switch between five AI models for different perspectives</li>
          </ul>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Click &ldquo;New Chat&rdquo; to start a session.
        </p>
      </div>
    </div>
  );
}

function EmptyChatView() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-lg">
        <p className="text-muted-foreground mb-4">
          Start by asking a question or describing a sales scenario. For example:
        </p>
        <div className="space-y-2 text-left">
          {[
            "How does the chatbot handle price objections?",
            "What happens when a customer asks for a discount?",
            "Suggest a better closing technique for bulk buyers.",
            "How does the quote generation flow work?",
          ].map((example) => (
            <div
              key={example}
              className="text-sm bg-muted/50 rounded-md px-3 py-2 border"
            >
              {example}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  isStreaming,
}: {
  message: AdvisorMessage;
  isStreaming?: boolean;
}) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted border"
        }`}
      >
        <div className="whitespace-pre-wrap text-sm leading-relaxed break-words">
          {message.content}
          {isStreaming && (
            <span
              className="inline-block w-2 h-4 ml-1 align-text-bottom bg-current animate-pulse"
              aria-hidden
            />
          )}
        </div>
        {!isUser && message.model_id && (
          <div className="mt-2 text-xs text-muted-foreground">
            {message.model_id}
          </div>
        )}
      </div>
    </div>
  );
}

function ThinkingBubble({ modelId }: { modelId: AdvisorModelId | null }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] rounded-lg px-4 py-3 bg-muted border">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>AI is thinking</span>
          <span className="inline-flex gap-1" aria-hidden>
            <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
            <span className="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
            <span className="w-1 h-1 rounded-full bg-current animate-bounce" />
          </span>
        </div>
        {modelId && (
          <div className="mt-2 text-xs text-muted-foreground">{modelId}</div>
        )}
      </div>
    </div>
  );
}

function ChangeRequestCard({
  request,
  onRetry,
  onStatusChange,
}: {
  request: AdvisorChangeRequest;
  onRetry: () => void;
  onStatusChange: (status: AdvisorChangeRequest["status"]) => void;
}) {
  return (
    <Card className="text-xs">
      <CardHeader className="p-3 pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-medium leading-tight">
            {request.title}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-2 space-y-2">
        <div className="flex items-center gap-1 flex-wrap">
          <Badge className={`text-[10px] ${PRIORITY_COLORS[request.priority] ?? ""}`}>
            {request.priority}
          </Badge>
          <Badge className={`text-[10px] ${STATUS_COLORS[request.status] ?? ""}`}>
            {request.status.replace("_", " ")}
          </Badge>
          <Badge className={`text-[10px] ${NOTIFICATION_COLORS[request.notification_status] ?? ""}`}>
            <Mail className="h-2.5 w-2.5 mr-0.5" />
            {request.notification_status}
          </Badge>
        </div>
        <p className="text-muted-foreground line-clamp-2">
          {request.requested_behavior}
        </p>
        {request.affected_areas.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {request.affected_areas.map((area) => (
              <Badge key={area} variant="outline" className="text-[10px]">
                {area}
              </Badge>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1 pt-1">
          <Select
            value={request.status}
            onValueChange={(v) => onStatusChange(v as AdvisorChangeRequest["status"])}
          >
            <SelectTrigger className="h-7 text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_review">In Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="implemented">Implemented</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          {request.notification_status === "failed" && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={onRetry}
              title="Retry email"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ChangeRequestDialog({
  sessionId,
  onClose,
  onCreated,
  onError,
}: {
  sessionId?: string;
  onClose: () => void;
  onCreated: (req: AdvisorChangeRequest) => void;
  onError: (err: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [currentBehavior, setCurrentBehavior] = useState("");
  const [requestedBehavior, setRequestedBehavior] = useState("");
  const [rationale, setRationale] = useState("");
  const [priority, setPriority] = useState<AdvisorChangeRequestPriority>("medium");
  const [affectedAreas, setAffectedAreas] = useState("system_prompt");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !requestedBehavior.trim()) return;
    setSubmitting(true);
    const result = await createChangeRequestAction({
      sessionId,
      title: title.trim(),
      currentBehavior: currentBehavior.trim() || undefined,
      requestedBehavior: requestedBehavior.trim(),
      rationale: rationale.trim() || undefined,
      priority,
      affectedAreas: affectedAreas
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
    setSubmitting(false);
    if (result.ok) {
      onCreated(result.data);
    } else {
      onError(result.error);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Change Request</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="cr-title">Title *</Label>
            <Input
              id="cr-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Add discount approval flow for bulk buyers"
            />
          </div>
          <div>
            <Label htmlFor="cr-current">Current Behavior</Label>
            <Textarea
              id="cr-current"
              value={currentBehavior}
              onChange={(e) => setCurrentBehavior(e.target.value)}
              placeholder="How the chatbot currently handles this scenario..."
              rows={2}
            />
          </div>
          <div>
            <Label htmlFor="cr-requested">Requested Behavior *</Label>
            <Textarea
              id="cr-requested"
              value={requestedBehavior}
              onChange={(e) => setRequestedBehavior(e.target.value)}
              placeholder="What you want the chatbot to do instead..."
              rows={3}
            />
          </div>
          <div>
            <Label htmlFor="cr-rationale">Rationale</Label>
            <Textarea
              id="cr-rationale"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="Why this improvement matters (sales outcome)..."
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cr-priority">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as AdvisorChangeRequestPriority)}>
                <SelectTrigger id="cr-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="cr-areas">Affected Areas (comma-separated)</Label>
              <Input
                id="cr-areas"
                value={affectedAreas}
                onChange={(e) => setAffectedAreas(e.target.value)}
                placeholder="system_prompt, tool, workflow"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || !requestedBehavior.trim() || submitting}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Submit &amp; Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
