"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/lib/types";
import { formatDateTime } from "@/lib/constants";
import { ImageIcon, ImageOff } from "lucide-react";
import { CustomerImage } from "@/components/customer-image";

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
 * Extract the AI's image analysis from the message text. This is used to
 * show a description of the photo when the image itself was not stored
 * (older messages from before image storage was implemented).
 *
 * Returns a cleaned-up summary string, or null if no analysis is present.
 */
function extractImageAnalysis(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.match(/\[IMAGE ANALYSIS:\s*([\s\S]*?)\]\s*(?:\[IMAGE TYPE:|\[PHOTO QUALITY FLAG:|$)/i);
  if (!match) return null;
  let analysis = match[1].trim();
  // Truncate very long analyses for display
  if (analysis.length > 300) {
    analysis = analysis.slice(0, 300) + "…";
  }
  return analysis;
}

/**
 * Rewrite Supabase Storage URLs to go through the Next.js API route proxy
 * (/api/customer-image/...) so images are served from the same origin.
 * This avoids cross-origin image loading issues that prevent <img> tags
 * from rendering Supabase images in the browser.
 */
const SUPABASE_HOST = "xzsibbbghotreolzwnyk.supabase.co";
function proxyStorageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.host === SUPABASE_HOST && parsed.pathname.startsWith("/storage/")) {
      // Strip leading slash from pathname since the catch-all route adds it back
      const pathWithoutLeadingSlash = parsed.pathname.replace(/^\//, "");
      return `/api/customer-image/${pathWithoutLeadingSlash}${parsed.search}${parsed.hash}`;
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
          // Rewrite Supabase Storage URLs to go through the same-origin API
          // route proxy so images load reliably in the browser.
          const proxiedImageUrl = hasImageUrl
            ? proxyStorageUrl(msg.image_url!)
            : null;
          // For messages without a stored image, extract the AI's analysis
          // so we can show what the photo contained.
          const imageAnalysis = !proxiedImageUrl && isImageMessage
            ? extractImageAnalysis(rawText)
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
                      <CustomerImage
                        src={proxiedImageUrl}
                        alt="Customer image"
                        href={proxiedImageUrl}
                      />
                    ) : (
                      <div className="rounded-md border border-dashed border-border/60 px-3 py-2 text-xs">
                        <div className="flex items-center gap-2 opacity-70 mb-1">
                          <ImageOff className="h-4 w-4 shrink-0" />
                          <span className="italic">Photo sent (image not stored)</span>
                        </div>
                        {imageAnalysis && (
                          <p className="text-muted-foreground whitespace-pre-wrap break-words mt-1">
                            {imageAnalysis}
                          </p>
                        )}
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
