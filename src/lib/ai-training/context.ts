import { createAdminClient } from "@/lib/supabase/admin";
import type { AdvisorToolContract } from "@/lib/types";
import { createHash } from "crypto";
import fallbackContext from "./fallback-context.json";

/**
 * Sanitized context builder for the AI Training Advisor.
 *
 * Reads the checked-in n8n workflow export and extracts ONLY safe information:
 * - The system prompt (STATIC_SYSTEM_MESSAGE)
 * - Tool names, descriptions, and input schemas
 * - The workflow model and node topology (names/types only)
 *
 * It NEVER exposes jsCode, credentials, API keys, tokens, webhook secrets,
 * customer data, or any raw executable code.
 *
 * If the live workflow file is unavailable (e.g. on Vercel), it falls back
 * to a committed sanitized context file extracted from the workflow export.
 */

const WORKFLOW_PATH =
  process.env.HDS_WORKFLOW_PATH ||
  "/home/asif/Documents/FX GROUP/Chatbot Tests/n8n-workflow/HDS-WhatsApp-AI-Sales-Assistant.json";

type RawNode = {
  name: string;
  type: string;
  parameters: Record<string, unknown>;
};

type RawWorkflow = {
  name: string;
  versionId?: string;
  activeVersionId?: string;
  nodes: RawNode[];
  connections?: Record<string, unknown>;
};

type SanitizedContext = {
  workflowName: string;
  workflowVersion: string | null;
  workflowModel: string | null;
  systemPrompt: string | null;
  toolContracts: AdvisorToolContract[];
  topology: {
    nodeNames: string[];
    nodeTypes: string[];
    connectionSummary: Record<string, string[]>;
  };
  sourceTimestamp: string;
};

/**
 * Reads and parses the workflow export file.
 * Throws if the file cannot be read or parsed.
 */
async function readWorkflow(): Promise<RawWorkflow> {
  const fs = await import("fs/promises");
  const raw = await fs.readFile(WORKFLOW_PATH, "utf-8");
  return JSON.parse(raw) as RawWorkflow;
}

/**
 * Extracts the STATIC_SYSTEM_MESSAGE from the "Load Customer Context" code node.
 * This is the chatbot's system prompt — it's safe to share because it contains
 * sales rules and behavioral instructions, not credentials.
 */
function extractSystemPrompt(nodes: RawNode[]): string | null {
  const node = nodes.find((n) => n.name === "Load Customer Context");
  if (!node) return null;
  const js = (node.parameters.jsCode as string) ?? "";
  const marker = "const STATIC_SYSTEM_MESSAGE = `";
  const start = js.indexOf(marker);
  if (start < 0) return null;
  const promptStart = start + marker.length;
  const end = js.indexOf("`", promptStart);
  if (end < 0) return null;
  return js.slice(promptStart, end);
}

/**
 * Extracts tool contracts from langchain tool nodes.
 * Only extracts name, description, and input schema — never jsCode.
 */
function extractToolContracts(nodes: RawNode[]): AdvisorToolContract[] {
  return nodes
    .filter((n) => n.type.includes("langchain.tool"))
    .map((n) => {
      const params = n.parameters;
      const name = (params.name as string) ?? n.name;
      const description = (params.description as string) ?? "";
      const schema = (params.schema as Record<string, unknown>) ?? undefined;
      return { name, description, inputSchema: schema };
    });
}

/**
 * Extracts the model ID from the OpenRouter LM chat node.
 */
function extractWorkflowModel(nodes: RawNode[]): string | null {
  const node = nodes.find((n) => n.type.includes("lmChatOpenRouter"));
  if (!node) return null;
  return (node.parameters.model as string) ?? null;
}

/**
 * Extracts a safe topology summary: node names, types, and connections.
 * Never includes parameters, credentials, or code.
 */
function extractTopology(workflow: RawWorkflow) {
  const nodeNames = workflow.nodes.map((n) => n.name);
  const nodeTypes = workflow.nodes.map((n) => n.type);
  const connectionSummary: Record<string, string[]> = {};
  const connections = workflow.connections ?? {};
  for (const [source, outputs] of Object.entries(connections)) {
    if (typeof outputs !== "object" || outputs === null) continue;
    const targets: string[] = [];
    try {
      const outputMap = outputs as Record<string, unknown[][]>;
      for (const outputs of Object.values(outputMap)) {
        if (!Array.isArray(outputs)) continue;
        for (const output of outputs) {
          if (!Array.isArray(output)) continue;
          for (const conn of output) {
            if (conn && typeof conn === "object" && "node" in conn) {
              targets.push(String((conn as Record<string, unknown>).node));
            }
          }
        }
      }
    } catch {
      // Skip malformed connections
    }
    if (targets.length > 0) connectionSummary[source] = targets;
  }
  return { nodeNames, nodeTypes, connectionSummary };
}

/**
 * Patterns that indicate sensitive content that must never appear in context.
 * Used as a final safety check after allowlist extraction.
 */
const SENSITIVE_PATTERNS = [
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, // JWTs
  /sk-[A-Za-z0-9]{20,}/g, // OpenAI-style keys
  /password\s*[:=]\s*['"][^'"]+['"]/gi,
  /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi,
  /secret\s*[:=]\s*['"][^'"]+['"]/gi,
  /token\s*[:=]\s*['"][^'"]+['"]/gi,
];

function containsSensitiveData(text: string): boolean {
  return SENSITIVE_PATTERNS.some((p) => p.test(text));
}

/**
 * Builds the full sanitized context from the workflow export.
 * If the workflow file is unavailable (e.g. on Vercel), falls back to the
 * committed sanitized context file (fallback-context.json).
 */
export async function buildSanitizedWorkflowContext(): Promise<SanitizedContext | null> {
  let workflow: RawWorkflow;
  try {
    workflow = await readWorkflow();
  } catch {
    // Fall back to the committed sanitized context
    return {
      workflowName: fallbackContext.workflowName,
      workflowVersion: fallbackContext.workflowVersion ?? null,
      workflowModel: fallbackContext.workflowModel ?? null,
      systemPrompt: fallbackContext.systemPrompt ?? null,
      toolContracts: (fallbackContext.toolContracts as unknown as AdvisorToolContract[]),
      topology: fallbackContext.topology as SanitizedContext["topology"],
      sourceTimestamp: new Date().toISOString(),
    };
  }

  const systemPrompt = extractSystemPrompt(workflow.nodes);
  const toolContracts = extractToolContracts(workflow.nodes);
  const workflowModel = extractWorkflowModel(workflow.nodes);
  const topology = extractTopology(workflow);

  // Final safety check: ensure no sensitive data leaked into extracted context
  const combinedForCheck = [
    systemPrompt ?? "",
    ...toolContracts.map((t) => `${t.name} ${t.description}`),
  ].join("\n");

  if (containsSensitiveData(combinedForCheck)) {
    // If sensitive data is detected, strip the system prompt as a precaution
    return {
      workflowName: workflow.name,
      workflowVersion: workflow.versionId ?? null,
      workflowModel,
      systemPrompt: null, // Stripped for safety
      toolContracts,
      topology,
      sourceTimestamp: new Date().toISOString(),
    };
  }

  return {
    workflowName: workflow.name,
    workflowVersion: workflow.versionId ?? null,
    workflowModel,
    systemPrompt,
    toolContracts,
    topology,
    sourceTimestamp: new Date().toISOString(),
  };
}

/**
 * Computes a hash of the sanitized context for snapshot deduplication.
 */
export function hashContext(context: SanitizedContext): string {
  const payload = JSON.stringify({
    v: context.workflowVersion,
    m: context.workflowModel,
    p: context.systemPrompt,
    t: context.toolContracts,
    tp: context.topology,
  });
  return createHash("sha256").update(payload).digest("hex");
}

// ---------------------------------------------------------------------------
// Dashboard capability manifest
// ---------------------------------------------------------------------------

const DASHBOARD_MANIFEST = {
  name: "HDS CRM Dashboard",
  version: "0.1.0",
  routes: [
    { path: "/dashboard", roles: ["owner", "manager", "sales"], description: "KPI overview, recent activity, chatbot metrics" },
    { path: "/customers", roles: ["owner", "manager", "sales"], description: "Customer profiles, lead status, conversation history" },
    { path: "/segments", roles: ["owner", "manager"], description: "Customer segmentation by type, value, behavior" },
    { path: "/quotes", roles: ["owner", "manager", "sales"], description: "Quote list, status tracking, PDF generation" },
    { path: "/payments", roles: ["owner", "manager", "sales"], description: "Payment tracking, invoice status" },
    { path: "/intelligence", roles: ["owner", "manager"], description: "AI-extracted business insights from conversations" },
    { path: "/reports", roles: ["owner", "manager"], description: "Weekly performance reports" },
    { path: "/reports/ai-performance", roles: ["owner", "manager"], description: "Chatbot quality metrics, test runs, pass rates" },
    { path: "/health", roles: ["owner"], description: "System health monitoring (n8n, Supabase, Chatwoot, Meta API)" },
    { path: "/templates", roles: ["owner", "manager"], description: "WhatsApp message templates" },
    { path: "/broadcasts", roles: ["owner", "manager"], description: "Broadcast campaigns to customer segments" },
    { path: "/settings/users", roles: ["owner", "manager"], description: "User management, role assignment" },
    { path: "/ai-training", roles: ["owner", "manager"], description: "AI Training Advisor (this feature)" },
  ],
  roles: [
    { name: "owner", description: "Full access including system health, user management, and AI training" },
    { name: "manager", description: "Operational access excluding system health and AI training" },
    { name: "sales", description: "Customer, quote, and payment access only" },
  ],
  dataSources: [
    { table: "customer_profiles", description: "Aggregated customer data from WhatsApp conversations" },
    { table: "ai_conversations", description: "Raw WhatsApp conversation messages" },
    { table: "quotes", description: "Quotes generated by the chatbot" },
    { table: "invoices", description: "Invoices linked to quotes" },
    { table: "hds_prices", description: "Product pricing catalog" },
    { table: "intelligence_reports", description: "AI-extracted business intelligence" },
    { table: "ai_test_runs", description: "Chatbot test execution results (113 scenarios)" },
    { table: "ai_quality_metrics", description: "Chatbot quality scoring metrics" },
  ],
};

/**
 * Returns the static dashboard capability manifest.
 * This is curated and safe — no secrets or PII.
 */
export function getDashboardManifest() {
  return DASHBOARD_MANIFEST;
}

// ---------------------------------------------------------------------------
// Safe Supabase aggregates
// ---------------------------------------------------------------------------

type SupabaseAggregates = {
  customers: { total: number; byLeadStatus: Record<string, number> };
  conversations: { total: number; last7Days: number };
  quotes: { total: number; chatbotTotal: number; chatbotRevenue: number };
  testRuns: { total: number; passRate: number | null };
  intelligence: { total: number; byCategory: Record<string, number> };
  products: { total: number };
  branches: { total: number };
  generatedAt: string;
};

/**
 * Fetches safe aggregate metrics from Supabase using the service-role client.
 * Only returns counts and sums — never individual customer records or PII.
 */
export async function fetchSupabaseAggregates(): Promise<SupabaseAggregates> {
  const admin = createAdminClient();

  const [
    customersRes,
    conversationsRes,
    quotesRes,
    testRunsRes,
    testSummariesRes,
    intelligenceRes,
    productsRes,
    branchesRes,
  ] = await Promise.all([
    admin.from("customer_profiles").select("lead_status"),
    admin.from("ai_conversations").select("created_at"),
    admin.from("quotes").select("total, source"),
    admin.from("ai_test_runs").select("passed"),
    admin.from("ai_test_run_summaries").select("pass_rate").order("created_at", { ascending: false }).limit(1),
    admin.from("intelligence_reports").select("category"),
    admin.from("products").select("id", { count: "exact", head: true }),
    admin.from("branches").select("id", { count: "exact", head: true }),
  ]);

  const customers = customersRes.data ?? [];
  const byLeadStatus: Record<string, number> = {};
  for (const c of customers) {
    const status = c.lead_status ?? "unknown";
    byLeadStatus[status] = (byLeadStatus[status] ?? 0) + 1;
  }

  const conversations = conversationsRes.data ?? [];
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const last7Days = conversations.filter(
    (c) => new Date(c.created_at).getTime() > weekAgo,
  ).length;

  const quotes = quotesRes.data ?? [];
  const chatbotQuotes = quotes.filter((q) => q.source === "chatbot");
  const chatbotRevenue = chatbotQuotes.reduce(
    (sum, q) => sum + Number(q.total || 0),
    0,
  );

  const testRuns = testRunsRes.data ?? [];
  const passedCount = testRuns.filter((t) => t.passed === true).length;
  const passRate =
    testRuns.length > 0
      ? Math.round((passedCount / testRuns.length) * 100)
      : (testSummariesRes.data?.[0]?.pass_rate ?? null);

  const intelligence = intelligenceRes.data ?? [];
  const byCategory: Record<string, number> = {};
  for (const r of intelligence) {
    const cat = r.category ?? "unknown";
    byCategory[cat] = (byCategory[cat] ?? 0) + 1;
  }

  return {
    customers: { total: customers.length, byLeadStatus },
    conversations: { total: conversations.length, last7Days },
    quotes: {
      total: quotes.length,
      chatbotTotal: chatbotQuotes.length,
      chatbotRevenue,
    },
    testRuns: { total: testRuns.length, passRate },
    intelligence: { total: intelligence.length, byCategory },
    products: { total: productsRes.count ?? 0 },
    branches: { total: branchesRes.count ?? 0 },
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Full context assembly + snapshot persistence
// ---------------------------------------------------------------------------

export type AssembledContext = {
  workflowName: string;
  workflowVersion: string | null;
  workflowModel: string | null;
  systemPrompt: string | null;
  toolContracts: AdvisorToolContract[];
  topology: Record<string, unknown>;
  dashboardManifest: Record<string, unknown>;
  supabaseAggregates: Record<string, unknown>;
  sourceTimestamps: Record<string, string>;
  isStale: boolean;
  contentHash: string;
};

/**
 * Assembles the full sanitized context: workflow + dashboard + aggregates.
 * If the workflow file is unavailable, marks the context as stale and uses
 * the last successful snapshot (caller handles fallback).
 */
export async function assembleContext(): Promise<AssembledContext> {
  const workflowContext = await buildSanitizedWorkflowContext();
  const dashboardManifest = getDashboardManifest();
  const supabaseAggregates = await fetchSupabaseAggregates().catch(() => null);

  const sourceTimestamps: Record<string, string> = {
    workflow: workflowContext?.sourceTimestamp ?? new Date().toISOString(),
    dashboard: new Date().toISOString(),
    supabase: supabaseAggregates?.generatedAt ?? new Date().toISOString(),
  };

  const partialContext = {
    v: workflowContext?.workflowVersion,
    m: workflowContext?.workflowModel,
    p: workflowContext?.systemPrompt,
    t: workflowContext?.toolContracts,
    tp: workflowContext?.topology,
    dm: dashboardManifest,
    sa: supabaseAggregates,
  };
  const contentHash = createHash("sha256")
    .update(JSON.stringify(partialContext))
    .digest("hex");

  return {
    workflowName: workflowContext?.workflowName ?? "Unknown",
    workflowVersion: workflowContext?.workflowVersion ?? null,
    workflowModel: workflowContext?.workflowModel ?? null,
    systemPrompt: workflowContext?.systemPrompt ?? null,
    toolContracts: workflowContext?.toolContracts ?? [],
    topology: workflowContext?.topology ?? {},
    dashboardManifest: dashboardManifest as unknown as Record<string, unknown>,
    supabaseAggregates: (supabaseAggregates ?? { error: "unavailable" }) as Record<string, unknown>,
    sourceTimestamps,
    isStale: workflowContext?.systemPrompt == null,
    contentHash,
  };
}

/**
 * Gets or creates a context snapshot in Supabase, deduplicating by content hash.
 * Returns the snapshot ID for linking to messages and change requests.
 */
export async function getOrCreateSnapshot(
  context: AssembledContext,
): Promise<string | null> {
  const admin = createAdminClient();

  // Check if a snapshot with this hash already exists
  const { data: existing } = await admin
    .from("ai_training_context_snapshots")
    .select("id")
    .eq("content_hash", context.contentHash)
    .maybeSingle();

  if (existing) return existing.id;

  // Create a new snapshot
  const { data, error } = await admin
    .from("ai_training_context_snapshots")
    .insert({
      content_hash: context.contentHash,
      workflow_version: context.workflowVersion,
      workflow_model: context.workflowModel,
      system_prompt: context.systemPrompt,
      tool_contracts: context.toolContracts,
      topology: context.topology,
      dashboard_manifest: context.dashboardManifest,
      supabase_aggregates: context.supabaseAggregates,
      source_timestamps: context.sourceTimestamps,
      is_stale: context.isStale,
    })
    .select("id")
    .single();

  if (error || !data) return null;
  return data.id;
}

/**
 * Builds the system instruction string sent to OpenRouter.
 * This tells the model what it is, what it can do, and what it must not do.
 */
export function buildSystemInstruction(context: AssembledContext): string {
  const toolList = context.toolContracts
    .map((t) => `- **${t.name}**: ${t.description}`)
    .join("\n");

  const aggregateSummary = context.supabaseAggregates
    ? JSON.stringify(context.supabaseAggregates, null, 2)
    : "Aggregates unavailable";

  return `You are the HDS AI Training Advisor — a read-only advisory assistant for the owner and sales manager of HDS Group, a South African board materials and hardware distributor.

## Who You Are Talking To
The people using this chat are the CEO and the sales manager. They are NOT technical. They are sharp business people with decades of sales experience, but they do not want to read about workflows, nodes, schemas, JSON, tokens, or system architecture. Talk to them like a trusted colleague sitting across the desk — plain English, short sentences, no jargon.

## Your Job
1. Explain how the WhatsApp sales chatbot currently behaves — in plain business terms.
2. Discuss better sales responses and closing techniques, drawing on the owner's sales experience.
3. When asked, capture an improvement as a change request for the dev team to implement.
4. When the user uploads an image, document, or voice note, read and respond to it naturally. They might share a screenshot of a chatbot conversation, a sales script document, or a voice note describing a situation.

## How To Talk — READ THIS CAREFULLY
- **Be brief.** Most answers should be 2-4 short sentences. Never write more than 150 words unless the person explicitly asks for detail.
- **Lead with the answer.** First sentence answers the question. Only add context if asked.
- **No jargon.** Don't say "workflow node", "tool schema", "system prompt", "token budget", "context snapshot". Say "the chatbot", "what the chatbot can do", "the rules the chatbot follows", "the chatbot's instructions".
- **No headers or bullet lists unless the person asks for a list.** Write in plain paragraphs, like a chat message from a colleague.
- **No disclaimers or filler.** Don't start with "Great question!" or "I'd be happy to help." Don't end with "Let me know if you'd like to know more." Just answer.
- **No lectures.** Don't explain how AI works. Don't explain what a change request is. Just do the thing.
- **Be direct and honest.** If something is a bad idea, say so plainly and say why in one sentence.
- **Use the person's own words.** If they say "the bot keeps losing deals at pricing", talk about "losing deals at pricing" — don't reframe it as "suboptimal objection handling in the pricing phase".
- **When discussing sales technique**, be practical and concrete. Give the actual words the chatbot should say, not theory.

## What You Cannot Do
- You are READ-ONLY. You cannot change the chatbot, the system, or any data. Never claim you have.
- Never reveal passwords, API keys, tokens, or internal secrets.
- Don't invent facts about the system. If you're not sure, say "I'm not sure about that" — one sentence, then move on.
- Keep three things separate: what the chatbot definitely does now, what the numbers show, and what you suggest trying. Don't blur them together.

## Current Chatbot Setup (for your reference — do not dump this on the user)
- Workflow: ${context.workflowName} (version ${context.workflowVersion ?? "unknown"})
- Model: ${context.workflowModel ?? "unknown"}
- Context: ${context.isStale ? "stale — using last known setup" : "live"}
- The chatbot's rules (system prompt), capabilities (tools), and current metrics are below. Use these to answer questions accurately, but translate everything into plain business language before replying.

### The chatbot's current rules
${context.systemPrompt ?? "[Rules unavailable — context is stale]"}

### What the chatbot can do
${toolList || "[No capabilities found]"}

### Dashboard features available
${JSON.stringify(context.dashboardManifest, null, 2)}

### Current performance numbers (no customer details)
${aggregateSummary}

## Capturing a Change Request
When the owner or sales manager describes an improvement AND confirms they want it logged (or says something like "create a change request", "send for review", "log this change", "file this"), end your reply with a fenced code block tagged \`change-request\` containing ONE JSON object. The dashboard hides this block from the chat and files it automatically.

Keep your visible reply short — one or two sentences like "Logged it for the dev team to review." Then the block.

\`\`\`change-request
{
  "title": "Short summary of the change",
  "current_behavior": "How the chatbot handles this now",
  "requested_behavior": "What you want it to do instead",
  "rationale": "Why this helps close more sales",
  "examples": [{ "customerMessage": "...", "desiredReply": "..." }],
  "affected_areas": ["system_prompt", "tool", "workflow", "dashboard", "database", "tests"],
  "priority": "low" | "medium" | "high" | "critical",
  "risks": "What could go wrong",
  "acceptance_criteria": "How we'll know it works"
}
\`\`\`

Rules for the block:
- Required: \`title\` (3-200 chars) and \`requested_behavior\` (10-5000 chars). Rest optional.
- \`affected_areas\` picks from: system_prompt, tool, workflow, dashboard, database, tests.
- \`priority\` is low, medium, high, or critical. Default medium.
- \`examples\` is up to 10 { customerMessage, desiredReply } pairs.
- Only emit the block when the person confirms they want it filed. If they're still thinking it through, just discuss it in plain English and ask "Want me to log this for the dev team?" — don't emit the block.
- Never put text after the closing fence.`;
}
