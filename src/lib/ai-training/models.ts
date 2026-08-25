import type { AdvisorModelId } from "@/lib/types";

/**
 * Server-side allowlist of OpenRouter models exposed in the AI Training
 * Advisor. The browser may only select from these IDs — arbitrary model IDs
 * are rejected by the chat API route.
 */
export const ADVISOR_MODELS: ReadonlyArray<{
  id: AdvisorModelId;
  label: string;
  description: string;
  defaultMaxTokens: number;
}> = [
  {
    id: "anthropic/claude-sonnet-5",
    label: "Claude Sonnet 5",
    description: "Anthropic — strong reasoning and structured output. Recommended default.",
    defaultMaxTokens: 4096,
  },
  {
    id: "openai/gpt-5.6-sol",
    label: "GPT-5.6 Sol",
    description: "OpenAI — fast, capable general-purpose model.",
    defaultMaxTokens: 4096,
  },
  {
    id: "moonshotai/kimi-k3",
    label: "Kimi K3",
    description: "Moonshot AI — long-context agentic model.",
    defaultMaxTokens: 4096,
  },
  {
    id: "deepseek/deepseek-v4-pro-0813",
    label: "DeepSeek V4 Pro",
    description: "DeepSeek — cost-effective reasoning model.",
    defaultMaxTokens: 4096,
  },
  {
    id: "qwen/qwen3.8-max",
    label: "Qwen 3.8 Max",
    description: "Qwen — currently used by the WhatsApp chatbot workflow.",
    defaultMaxTokens: 4096,
  },
];

export const DEFAULT_ADVISOR_MODEL: AdvisorModelId = "anthropic/claude-sonnet-5";

export const ADVISOR_MODEL_IDS: ReadonlyArray<AdvisorModelId> = ADVISOR_MODELS.map(
  (m) => m.id,
);

/** Returns true if `id` is in the allowlist. */
export function isValidAdvisorModel(id: string): id is AdvisorModelId {
  return (ADVISOR_MODEL_IDS as ReadonlyArray<string>).includes(id);
}

/** Returns the model config for `id`, or null if not allowed. */
export function getAdvisorModel(id: string) {
  return ADVISOR_MODELS.find((m) => m.id === id) ?? null;
}

/** Returns a safe list of models for the browser (no secrets). */
export function getPublicAdvisorModels() {
  return ADVISOR_MODELS.map((m) => ({
    id: m.id,
    label: m.label,
    description: m.description,
  }));
}
