"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/lib/types";
import { formatDateTime } from "@/lib/constants";

export function ConversationLog({
  conversations,
}: {
  conversations: Conversation[];
}) {
  return (
    <ScrollArea className="h-[500px] rounded-lg border p-4">
      <div className="space-y-4">
        {conversations.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            No conversations yet
          </p>
        )}
        {conversations.map((msg) => {
          const isUser = msg.role === "user";
          const isTool = msg.role === "tool";

          return (
            <div
              key={msg.id}
              className={cn(
                "flex flex-col gap-1",
                isUser ? "items-end" : "items-start"
              )}
            >
              <div
                className={cn(
                  "rounded-lg px-3 py-2 max-w-[80%] text-sm",
                  isUser
                    ? "bg-primary text-primary-foreground"
                    : isTool
                    ? "bg-muted text-muted-foreground border"
                    : "bg-accent text-accent-foreground"
                )}
              >
                {isTool && (
                  <span className="text-xs font-medium text-muted-foreground block mb-1">
                    Tool Result
                  </span>
                )}
                <p className="whitespace-pre-wrap break-words">
                  {msg.content?.slice(0, 500) || "—"}
                </p>
              </div>
              <span className="text-xs text-muted-foreground px-1">
                {formatDateTime(msg.created_at)}
              </span>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
