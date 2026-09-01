"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/lib/types";
import { formatDateTime } from "@/lib/constants";
import { ImageIcon, ImageOff } from "lucide-react";

/**
 * Strip the AI's internal image analysis markers from the message text so
 * customers' actual messages are displayed cleanly. The following internal
 * markers are removed:
 *   - [IMAGE ANALYSIS: ...]  (Gemini vision output — can be very long)
 *   - [IMAGE TYPE: ...]
 *   - [PHOTO QUALITY FLAG: ...]
 *   - [IMAGE LOAD ERROR]
 *   - [Customer sent a photo]
 *
 * Returns the remaining customer-facing text (may be empty for photo-only
 * messages).
 */
function stripImageAnalysis(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/\[IMAGE ANALYSIS:[\s\S]*$/i, "")
    .replace(/\[IMAGE TYPE:[^\]]*\]/gi, "")
    .replace(/\[PHOTO QUALITY FLAG:[^\]]*\]/gi, "")
    .replace(/\[IMAGE LOAD ERROR\]/gi, "")
    .replace(/\[Customer sent a photo\]/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Rewrite Supabase Storage URLs to go through the Next.js rewrite proxy
 * (/storage/...) so images are served from the same origin. This avoids
 * third-party image loading issues (referrer/Cloudflare blocks) when
 * displaying customer photos in the conversation log.
 */
const SUPABASE_HOST = "xzsibbbghotreolzwnyk.supabase.co";
function proxyStorageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.host === SUPABASE_HOST && parsed.pathname.startsWith("/storage/")) {
      // Replace the host with the proxy path; keep the rest of the path + query
      const proxyPath = parsed.pathname + parsed.search + parsed.hash;
      return proxyPath;
    }
  } catch {
    // Not a valid URL — return as-is
  }
  return url;
}

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
          const hasImageUrl = !!msg.image_url;
          const rawText = msg.message_text || "";
          // Detect image messages: either we have a stored URL or the text
          // contains AI image-analysis markers.
          const isImageMessage =
            hasImageUrl ||
            /\[IMAGE ANALYSIS:|\[IMAGE TYPE:|\[PHOTO QUALITY FLAG:|\[Customer sent a photo\]/i.test(
              rawText
            );
          // Clean text shown to the user (analysis stripped out).
          const cleanText = isImageMessage
            ? stripImageAnalysis(rawText)
            : rawText;
          const hasCustomerText = cleanText.length > 0;
          // Rewrite Supabase Storage URLs to go through the same-origin proxy
          // so images load reliably in the browser.
          const proxiedImageUrl = hasImageUrl
            ? proxyStorageUrl(msg.image_url!)
            : null;

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

                {/* Customer image: thumbnail if we have the URL, otherwise a
                    placeholder so the user knows a photo was sent. */}
                {isImageMessage && (
                  <div className="mb-2">
                    {proxiedImageUrl ? (
                      <a
                        href={proxiedImageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block group"
                      >
                        <div className="relative rounded-md overflow-hidden border border-border/50 inline-block">
                          <img
                            src={proxiedImageUrl}
                            alt="Customer image"
                            className="max-h-48 max-w-full object-cover transition-opacity group-hover:opacity-90"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <ImageIcon className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      </a>
                    ) : (
                      <div className="flex items-center gap-2 rounded-md border border-dashed border-border/60 px-3 py-2 text-xs italic opacity-70">
                        <ImageOff className="h-4 w-4 shrink-0" />
                        <span>Photo sent (image not stored)</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Customer-facing text. For photo-only messages with no
                    remaining text, show a small label. */}
                {hasCustomerText ? (
                  <p className="whitespace-pre-wrap break-words">
                    {cleanText.slice(0, 500)}
                  </p>
                ) : isImageMessage ? (
                  <p className="text-xs italic opacity-70">
                    Customer sent a photo
                  </p>
                ) : (
                  <p className="whitespace-pre-wrap break-words">—</p>
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
