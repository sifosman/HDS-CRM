"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2, Square, Plus, MessageSquare, Archive, Trash2, Pencil, Check, X, AlertCircle, Clock, RefreshCw, Paperclip, ImageIcon, FileText, Mic, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  AdvisorAttachment,
  AdvisorPricingChange,
} from "@/lib/types";
import { getPublicAdvisorModels } from "@/lib/ai-training/models";
import { stripChangeRequestBlock } from "@/lib/ai-training/change-request-parser";
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
import {
  ChangeRequestDetailDialog,
  PRIORITY_BORDER_COLORS,
  STATUS_DOT_COLORS,
} from "@/components/ai-training/change-request-detail-dialog";

const MODELS = getPublicAdvisorModels();

type TrainingWorkspaceProps = {
  sessions: AdvisorSession[];
  currentSession: AdvisorSession | null;
  messages: AdvisorMessage[];
  changeRequests: AdvisorChangeRequest[];
  contextInfo: { isStale: boolean; timestamps: Record<string, string> } | null;
  currentUserId: string;
  ownerNames: Record<string, string>;
};

export function TrainingWorkspace({
  sessions: initialSessions,
  currentSession,
  messages: initialMessages,
  changeRequests: initialChangeRequests,
  contextInfo,
  currentUserId,
  ownerNames,
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
  const [selectedChangeRequest, setSelectedChangeRequest] = useState<AdvisorChangeRequest | null>(null);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<AdvisorAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [modelSwitchNote, setModelSwitchNote] = useState<string | null>(null);
  const [toolCallNote, setToolCallNote] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamingTextRef = useRef("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Whether the current user can modify the current session. Users can view
  // any session but only send messages, upload files, rename, archive, delete,
  // and change the model in sessions they own.
  const canEdit = currentSession ? currentSession.owner_id === currentUserId : true;

  // Sync state when session changes (navigation).
  // The key prop on TrainingWorkspace in the page components forces a full
  // remount when the session ID changes, so this effect is a safety net for
  // cases where the component is NOT remounted (e.g. router.refresh without
  // a session change, or future changes to the key prop).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSessions(initialSessions);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessages(initialMessages);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChangeRequests(initialChangeRequests);
    setTitleValue(currentSession?.title ?? "");
    setError(null);
    setStreamingText("");
    setIsCreatingChat(false);
    // Abort any in-flight stream when the session changes.
    abortRef.current?.abort();
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
        // The key prop on TrainingWorkspace forces a remount on navigation,
        // which resets isCreatingChat to false. But in case the component
        // is not remounted, reset it here too.
        setIsCreatingChat(false);
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

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0 || !currentSession) return;
    setError(null);
    setIsUploading(true);

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("sessionId", currentSession.id);

        const response = await fetch("/api/ai-training/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error ?? `Upload failed: ${response.status}`);
        }

        const { attachment } = await response.json() as { attachment: AdvisorAttachment };
        setPendingAttachments((prev) => [...prev, attachment]);
      } catch (err) {
        setError(
          err instanceof Error
            ? `Could not upload ${file.name}: ${err.message}`
            : "Upload failed",
        );
      }
    }

    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleSend = async () => {
    if (!currentSession || !input.trim() || isStreaming) return;
    const userMessage = input.trim();
    const attachmentsToSend = [...pendingAttachments];
    setInput("");
    setError(null);
    setModelSwitchNote(null);
    setToolCallNote(null);
    setPendingAttachments([]);
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
      attachments: attachmentsToSend,
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
          attachments: attachmentsToSend.length > 0 ? attachmentsToSend : undefined,
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
                const nextChunk = (streamingTextRef.current + parsed.token) as string;
                streamingTextRef.current = nextChunk;
                // Hide any in-progress or complete change-request JSON block
                // from the streamed view; the server strips + files it.
                setStreamingText(stripChangeRequestBlock(nextChunk));
                // Clear the tool call note once the AI starts responding
                if (toolCallNote) setToolCallNote(null);
              } else if (currentEvent === "meta") {
                if (parsed.modelSwitched && parsed.modelSwitchReason) {
                  setModelSwitchNote(parsed.modelSwitchReason);
                }
              } else if (currentEvent === "tool_call") {
                // Show a brief "looking up..." indicator when the AI
                // queries the database for customer data
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

      // Add the assistant message. Prefer the server's cleaned text (which has
      // any change-request JSON block stripped) over the raw streamed text.
      const finalText = cleanedFinalText ?? streamingTextRef.current;
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
          attachments: [],
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
            attachments: [],
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
      setToolCallNote(null);
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
              sessions.map((session) => {
                const isOwned = session.owner_id === currentUserId;
                const ownerLabel = ownerNames[session.owner_id];
                return (
                  <div
                    key={session.id}
                    className={`group flex items-center gap-2 rounded-md px-2 py-2 text-sm cursor-pointer hover:bg-muted transition-colors ${
                      currentSession?.id === session.id ? "bg-muted font-medium" : ""
                    }`}
                    onClick={() => router.push(`/ai-training/${session.id}`)}
                  >
                    <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <span className="truncate block">{session.title}</span>
                      {!isOwned && ownerLabel && (
                        <span className="text-[10px] text-muted-foreground truncate block">
                          {ownerLabel}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
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
                {editingTitle && canEdit ? (
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
                    className={`text-lg font-heading font-bold truncate flex items-center gap-2 ${
                      canEdit ? "cursor-pointer hover:text-primary" : ""
                    }`}
                    onClick={() => canEdit && setEditingTitle(true)}
                  >
                    {currentSession.title}
                    {canEdit && <Pencil className="h-3 w-3 text-muted-foreground" />}
                  </h2>
                )}
                {!canEdit && (
                  <Badge variant="secondary" className="text-xs shrink-0">
                    Read-only
                  </Badge>
                )}
              </div>

              <Select
                value={currentSession.selected_model}
                onValueChange={(v) => v && canEdit && handleModelChange(v)}
                disabled={!canEdit}
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

              {canEdit && (
                <>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleArchive} title="Archive">
                    <Archive className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setShowDeleteConfirm(true)} title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
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
                    attachments: [],
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
          <div
            className="border-t px-4 py-3"
            onDrop={canEdit ? handleDrop : undefined}
            onDragOver={canEdit ? handleDragOver : undefined}
          >
            {error && (
              <div className="mb-2 flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
            {modelSwitchNote && (
              <div className="mb-2 flex items-center gap-2 text-xs text-blue-700 bg-blue-50 rounded-md px-3 py-2">
                <RefreshCw className="h-3 w-3 shrink-0" />
                {modelSwitchNote}
              </div>
            )}
            {toolCallNote && (
              <div className="mb-2 flex items-center gap-2 text-xs text-blue-700 bg-blue-50 rounded-md px-3 py-2">
                <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                {toolCallNote}
              </div>
            )}
            {pendingAttachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2 max-w-3xl mx-auto">
                {pendingAttachments.map((att) => (
                  <AttachmentChip
                    key={att.id}
                    attachment={att}
                    onRemove={() => handleRemoveAttachment(att.id)}
                  />
                ))}
              </div>
            )}
            {canEdit ? (
              <div className="flex items-end gap-2 max-w-3xl mx-auto">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,text/plain,text/csv,.docx,audio/mpeg,audio/wav,audio/webm,audio/ogg,audio/aac,audio/m4a,audio/mp4"
                  onChange={(e) => handleFileSelect(e.target.files)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isStreaming || isUploading}
                  title="Attach image, document, or voice note"
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Paperclip className="h-4 w-4" />
                  )}
                </Button>
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about the chatbot, suggest an improvement, or describe a sales situation..."
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
                    disabled={!input.trim() && pendingAttachments.length === 0}
                    size="icon"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ) : (
              <div className="max-w-3xl mx-auto text-center text-sm text-muted-foreground py-2">
                You are viewing this session in read-only mode. Only{" "}
                {ownerNames[currentSession.owner_id] ?? "the owner"} can send
                messages here.
              </div>
            )}
            {canEdit && (
              <p className="text-xs text-muted-foreground mt-1 text-center">
                This is a read-only advisor — nothing changes in the live system.
                You can attach images, documents, or voice notes.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Change requests sidebar */}
      <div className="w-80 border-l flex flex-col bg-muted/30">
        <div className="p-3 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Change Requests</h3>
            {currentSession && canEdit && (
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
          <div className="p-1 space-y-0.5">
            {changeRequests.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                No change requests yet. Talk through an improvement, then log one.
              </p>
            ) : (
              changeRequests.map((req) => (
                <ChangeRequestListItem
                  key={req.id}
                  request={req}
                  ownerName={ownerNames[req.owner_id]}
                  onClick={() => setSelectedChangeRequest(req)}
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

      {/* Change request detail dialog */}
      {selectedChangeRequest && (
        <ChangeRequestDetailDialog
          request={selectedChangeRequest}
          ownerName={ownerNames[selectedChangeRequest.owner_id]}
          onClose={() => setSelectedChangeRequest(null)}
          onStatusChange={(status) => {
            updateChangeRequestStatusAction(selectedChangeRequest.id, status).then((r) => {
              if (r.ok) {
                setChangeRequests((prev) =>
                  prev.map((cr) =>
                    cr.id === selectedChangeRequest.id ? { ...cr, status } : cr,
                  ),
                );
                setSelectedChangeRequest((prev) => prev ? { ...prev, status } : prev);
              }
            });
          }}
          onRetry={() => {
            retryNotificationAction(selectedChangeRequest.id).then((r) => {
              if (r.ok) {
                setChangeRequests((prev) =>
                  prev.map((cr) => (cr.id === selectedChangeRequest.id ? r.data : cr)),
                );
                setSelectedChangeRequest(r.data);
              }
            });
          }}
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
          A private space to talk about how the WhatsApp sales chatbot should
          handle customers and close deals. Suggest improvements, log them for
          the dev team, and track progress — nothing changes in the live system.
        </p>
        <div className="text-left bg-muted/50 rounded-lg p-4 space-y-2">
          <p className="text-sm font-medium">You can:</p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Ask how the chatbot handles a sales situation right now</li>
            <li>Suggest better responses based on your sales experience</li>
            <li>Log a change request for the dev team to review</li>
            <li>Switch between six AI models for different perspectives</li>
            <li>Attach images, documents, or voice notes for the AI to read</li>
          </ul>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Click &ldquo;New Chat&rdquo; to start.
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
          Ask a question or describe a sales situation. For example:
        </p>
        <div className="space-y-2 text-left">
          {[
            "How does the chatbot handle it when a customer says it's too expensive?",
            "What does the bot do when someone asks for a discount?",
            "Give me a better way to close bulk buyers.",
            "How does the chatbot send a quote to a customer?",
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

function AttachmentIcon({ type, className }: { type: string; className?: string }) {
  if (type === "image") return <ImageIcon className={className} />;
  if (type === "audio") return <Mic className={className} />;
  return <FileText className={className} />;
}

function AttachmentChip({
  attachment,
  onRemove,
}: {
  attachment: AdvisorAttachment;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-muted border rounded-md px-2 py-1.5 text-xs">
      <AttachmentIcon type={attachment.type} className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate max-w-[180px]">{attachment.filename}</span>
      <span className="text-muted-foreground">
        {Math.round(attachment.size / 1024)} KB
      </span>
      <button
        onClick={onRemove}
        className="text-muted-foreground hover:text-destructive shrink-0"
        title="Remove"
      >
        <XCircle className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function AttachmentDisplay({ attachment }: { attachment: AdvisorAttachment }) {
  return (
    <div className="flex items-center gap-1.5 text-xs opacity-90 bg-black/5 rounded px-2 py-1">
      <AttachmentIcon type={attachment.type} className="h-3 w-3 shrink-0" />
      <span className="truncate max-w-[200px]">{attachment.filename}</span>
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
  const attachments = message.attachments ?? [];
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-3 ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted border"
        }`}
      >
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((att) => (
              <AttachmentDisplay key={att.id} attachment={att} />
            ))}
          </div>
        )}
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

function ChangeRequestListItem({
  request,
  ownerName,
  onClick,
}: {
  request: AdvisorChangeRequest;
  ownerName?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2 pl-2 pr-1.5 py-2 text-left rounded-md border-l-2 hover:bg-accent transition-colors text-xs ${
        PRIORITY_BORDER_COLORS[request.priority] ?? "border-l-transparent"
      }`}
      title={request.title}
    >
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT_COLORS[request.status] ?? "bg-gray-400"}`}
        title={`Status: ${request.status.replace("_", " ")}`}
      />
      <div className="flex-1 min-w-0">
        <span className="truncate block font-medium">{request.title}</span>
        {ownerName && (
          <span className="text-[10px] text-muted-foreground truncate block">
            {ownerName}
          </span>
        )}
      </div>
      {request.notification_status === "failed" && (
        <span title="Email notification failed">
          <AlertCircle className="h-3 w-3 shrink-0 text-red-500" />
        </span>
      )}
      <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
        {request.status.replace("_", " ")}
      </span>
    </button>
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
