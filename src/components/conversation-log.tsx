"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/lib/types";
import { formatDateTime } from "@/lib/constants";
import { ImageIcon } from "lucide-react";

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
          const hasImage = !!msg.image_url;
          // For image messages, show a cleaner label instead of the raw analysis text
          const isImageOnly =
            hasImage &&
            (msg.message_text?.startsWith("[Customer sent a photo]") ||
              msg.message_text?.trim() === "[Customer sent a photo]");

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
                {hasImage && (
                  <a
                    href={msg.image_url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block mb-2 group"
                  >
                    <div className="relative rounded-md overflow-hidden border border-border/50 inline-block">
                      <img
                        src={msg.image_url!}
                        alt="Customer image"
                        className="max-h-48 max-w-full object-cover transition-opacity group-hover:opacity-90"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <ImageIcon className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </a>
                )}
                {isImageOnly ? (
                  <p className="text-xs italic opacity-70">
                    Customer sent a photo
                  </p>
                ) : (
                  <p className="whitespace-pre-wrap break-words">
                    {msg.message_text?.slice(0, 500) || "—"}
                  </p>
                )}
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
