"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/lib/types";
import { formatDateTime } from "@/lib/constants";
import { ImageIcon, ImageOff, FileText, ExternalLink } from "lucide-react";
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
 * Rewrite Supabase Storage URLs to go through the Next.js rewrite proxy
 * (/storage/...) so images are served from the same origin. The rewrite
 * proxy returns proper binary data (unlike API routes which serialize
 * binary as JSON Buffer on Vercel). The CustomerImage component fetches
 * the proxied URL via fetch() and creates a blob URL for the <img> src.
 *
 * A cache-busting query parameter is appended to bypass stale CDN caches
 * that may still hold the old corrupted JSON Buffer responses.
 */
const SUPABASE_HOST = "xzsibbbghotreolzwnyk.supabase.co";
function proxyStorageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.host === SUPABASE_HOST && parsed.pathname.startsWith("/storage/")) {
      // Append cache-busting parameter to bypass stale CDN cache
      const sep = parsed.search ? "&" : "?";
      const proxyPath = `${parsed.pathname}${parsed.search}${sep}v=fix${parsed.hash}`;
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

                {/* Quote PDF attachment: when a message has a quote_id and
                    the PDF URL is available in conversation_metadata, show a
                    clickable link to open the quote PDF. */}
                {msg.quote_id && (() => {
                  const meta = msg.conversation_metadata as Record<string, unknown> | null;
                  const pdfUrl = (meta?.quotePdfUrl as string) || null;
                  const quoteTotal = msg.quote_total ?? (meta?.quoteTotal as number) ?? null;
                  if (!pdfUrl) return null;
                  return (
                    <a
                      href={pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-md border border-border/60 bg-background/50 px-3 py-2 mb-2 hover:bg-background transition-colors group"
                    >
                      <FileText className="h-5 w-5 shrink-0 text-red-500" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium truncate">
                          Quote {msg.quote_id}
                        </span>
                        {quoteTotal != null && (
                          <span className="text-xs text-muted-foreground">
                            R {Number(quoteTotal).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground ml-auto group-hover:text-foreground transition-colors" />
                    </a>
                  );
                })()}

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
