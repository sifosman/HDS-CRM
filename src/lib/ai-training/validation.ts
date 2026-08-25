import { z } from "zod";
import { ADVISOR_MODEL_IDS, DEFAULT_ADVISOR_MODEL } from "./models";

export const advisorModelSchema = z.enum(
  ADVISOR_MODEL_IDS as unknown as [string, ...string[]],
  { message: "Invalid model" },
);

export const createSessionSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  selectedModel: advisorModelSchema.optional(),
});

export const renameSessionSchema = z.object({
  sessionId: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
});

export const archiveSessionSchema = z.object({
  sessionId: z.string().uuid(),
  archived: z.boolean(),
});

export const chatRequestSchema = z.object({
  sessionId: z.string().uuid(),
  message: z.string().trim().min(1).max(8000),
  model: advisorModelSchema.optional(),
});

export const changeRequestDraftSchema = z.object({
  sessionId: z.string().uuid().optional(),
  sourceMessageId: z.string().uuid().optional(),
  title: z.string().trim().min(3).max(200),
  currentBehavior: z.string().trim().max(5000).optional(),
  requestedBehavior: z.string().trim().min(10).max(5000),
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
  affectedAreas: z
    .array(z.string().trim().min(1).max(50))
    .max(10)
    .optional()
    .default([]),
  priority: z
    .enum(["low", "medium", "high", "critical"])
    .optional()
    .default("medium"),
  risks: z.string().trim().max(5000).optional(),
  acceptanceCriteria: z.string().trim().max(5000).optional(),
});

export const retryNotificationSchema = z.object({
  requestId: z.string().uuid(),
});

export const updateRequestStatusSchema = z.object({
  requestId: z.string().uuid(),
  status: z.enum(["pending", "in_review", "approved", "implemented", "rejected"]),
  implementationNotes: z.string().trim().max(5000).optional(),
});

export { DEFAULT_ADVISOR_MODEL };
