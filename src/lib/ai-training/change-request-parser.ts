import { z } from "zod";

/**
 * Parses a fenced ```change-request JSON block emitted by the AI Training
 * Advisor model and returns the cleaned text plus the structured draft.
 *
 * The model is instructed (via the system prompt) to append a single fenced
 * block tagged `change-request` containing a JSON object when the owner
 * confirms a change should be filed. This module extracts that block so the
 * chat route can:
 *   1. Strip it from the persisted/displayed assistant message.
 *   2. Create a real change request record from the parsed draft.
 *
 * If no block is present, or the block is malformed, this returns null and the
 * caller treats the message as a normal chat reply.
 */

// Mirrors the editable subset of changeRequestDraftSchema (validation.ts).
// We re-declare here so this module stays dependency-light and can be used
// from both server actions and route handlers without circular imports.
const draftSchema = z.object({
  title: z.string().trim().min(3).max(200),
  current_behavior: z.string().trim().max(5000).optional(),
  requested_behavior: z.string().trim().min(10).max(5000),
  rationale: z.string().trim().max(5000).optional(),
  examples: z
    .array(
      z.object({
        customerMessage: z.string().max(2000).optional(),
        desiredReply: z.string().max(2000).optional(),
      }),
    )
    .max(10)
    .optional()
    .default([]),
  affected_areas: z
    .array(z.string().trim().min(1).max(50))
    .max(10)
    .optional()
    .default([]),
  priority: z
    .enum(["low", "medium", "high", "critical"])
    .optional()
    .default("medium"),
  risks: z.string().trim().max(5000).optional(),
  acceptance_criteria: z.string().trim().max(5000).optional(),
});

export type ParsedChangeRequestDraft = z.infer<typeof draftSchema>;

export type ParsedChangeRequest = {
  draft: ParsedChangeRequestDraft;
  /** The assistant text with the fenced block removed (whitespace tidied). */
  cleanedText: string;
};

// Matches a fenced block tagged `change-request`. Allows the opening fence to
// have trailing whitespace. Captures the JSON body (group 1).
const BLOCK_REGEX = /```change-request\s*\n([\s\S]*?)\n```/;

/**
 * Extracts the first ```change-request block from `text`.
 * Returns null if no valid block is found.
 */
export function parseChangeRequestBlock(
  text: string,
): ParsedChangeRequest | null {
  const match = text.match(BLOCK_REGEX);
  if (!match) return null;

  const rawJson = match[1];
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return null;
  }

  const result = draftSchema.safeParse(parsed);
  if (!result.success) return null;

  // Remove the block and tidy up surrounding blank lines.
  const cleanedText = text
    .replace(BLOCK_REGEX, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { draft: result.data, cleanedText };
}

/**
 * Strips any ```change-request block from `text` for display purposes.
 * Used by the frontend to hide the JSON block while streaming, before the
 * server has had a chance to confirm/strip it.
 *
 * Handles both complete blocks (with a closing fence) and in-progress blocks
 * (opening fence present but not yet closed) — the latter is hidden entirely
 * so the user never sees raw JSON streaming in.
 */
export function stripChangeRequestBlock(text: string): string {
  // First remove any complete blocks.
  let out = text.replace(BLOCK_REGEX, "");
  // Then, if an opening fence remains without a close, drop everything from
  // that opening fence to the end (the block is still streaming in).
  const openIdx = out.indexOf("```change-request");
  if (openIdx !== -1) {
    out = out.slice(0, openIdx);
  }
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Returns true if `text` contains an opening ```change-request fence that has
 * not yet been closed. Kept for callers that need to distinguish "block still
 * streaming" from "no block at all".
 */
export function hasOpenChangeRequestBlock(text: string): boolean {
  const opens = (text.match(/```change-request/g) ?? []).length;
  const closes = (text.match(/```change-request[\s\S]*?\n```/g) ?? []).length;
  return opens > closes;
}
