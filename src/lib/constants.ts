export const LEAD_STATUS_LABELS: Record<string, string> = {
  new: "New",
  quoting: "Quoting",
  quoted: "Quoted",
  closing: "Closing",
  objection: "Objection",
  follow_up: "Follow Up",
  handover: "Handover",
  closed: "Closed",
  lost: "Lost",
};

export const LEAD_STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  quoting: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
  quoted: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  closing: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  objection: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  follow_up: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  handover: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  closed: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  lost: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  none: "None",
  pending: "Pending",
  paid: "Paid",
  partial: "Partial",
  overdue: "Overdue",
};

export const PAYMENT_STATUS_COLORS: Record<string, string> = {
  none: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  paid: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  partial: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  overdue: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export const CUSTOMER_TYPE_LABELS: Record<string, string> = {
  carpenter: "Carpenter",
  bulk_buyer: "Bulk Buyer",
  retail: "Retail",
  homeowner: "Homeowner",
  diy: "DIY",
  unknown: "Unknown",
};

export const CUSTOMER_TYPE_COLORS: Record<string, string> = {
  carpenter: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  bulk_buyer: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  retail: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
  homeowner: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  diy: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
  unknown: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export const CLASSIFICATION_SOURCE_LABELS: Record<string, string> = {
  ai: "AI",
  backfill: "Backfill",
  manual: "Manual",
  unknown: "—",
};

export const INTELLIGENCE_CATEGORY_LABELS: Record<string, string> = {
  competitor: "Competitor Mentions",
  pricing: "Pricing Insights",
  product_demand: "Product Demand",
  industry_trend: "Industry Trends",
  customer_service: "Customer Service",
  sales_opportunity: "Sales Opportunities",
  ai_quality: "AI Quality",
};

export const INTELLIGENCE_CATEGORY_COLORS: Record<string, string> = {
  competitor: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  pricing: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  product_demand: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  industry_trend: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  customer_service: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
  sales_opportunity: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  ai_quality: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
};

export const INTELLIGENCE_SEVERITY_LABELS: Record<string, string> = {
  info: "Info",
  warning: "Warning",
  critical: "Critical",
};

export const INTELLIGENCE_SEVERITY_COLORS: Record<string, string> = {
  info: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  critical: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export const PIPELINE_STAGES = [
  "new",
  "quoting",
  "quoted",
  "closing",
  "objection",
  "follow_up",
  "handover",
  "closed",
] as const;

export const HEALTH_STATUS_LABELS: Record<string, string> = {
  healthy: "Healthy",
  degraded: "Degraded",
  down: "Down",
  unknown: "Unknown",
};

export const HEALTH_STATUS_COLORS: Record<string, string> = {
  healthy: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  degraded: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  down: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  unknown: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

// Border/card accent colors for health cards
export const HEALTH_STATUS_BORDER: Record<string, string> = {
  healthy: "border-l-green-500",
  degraded: "border-l-amber-500",
  down: "border-l-red-500",
  unknown: "border-l-gray-400",
};

export const HEALTH_COMPONENT_LABELS: Record<string, string> = {
  n8n: "n8n Workflows",
  vercel_quote_api: "Vercel Quote API",
  supabase: "Supabase Database",
  chatwoot: "Chatwoot Inbox",
  meta_whatsapp: "Meta WhatsApp Business",
  meta_access_token: "Meta Access Token",
  meta_webhook: "Meta Webhook Subscription",
};

export const HEALTH_COMPONENT_DESCRIPTIONS: Record<string, string> = {
  n8n: "Chatbot & intelligence workflows active, last execution status",
  vercel_quote_api: "Quote engine API reachable, /api/optimizer/quote responding",
  supabase: "Database REST reachable, ai_conversations row freshness",
  chatwoot: "Chatwoot API reachable, inbox 2 responding for handovers",
  meta_whatsapp: "Phone number status, quality rating, messaging limit tier",
  meta_access_token: "WhatsApp Business access token expiry check",
  meta_webhook: "Webhook subscription status for the WhatsApp Business Account",
};

// Order components appear on the /health page
export const HEALTH_COMPONENT_ORDER = [
  "n8n",
  "vercel_quote_api",
  "supabase",
  "chatwoot",
  "meta_whatsapp",
  "meta_access_token",
  "meta_webhook",
] as const;

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "R0";
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  if (phone.startsWith("+27")) return phone;
  if (phone.startsWith("27")) return "+" + phone;
  if (phone.startsWith("0")) return "+27" + phone.slice(1);
  return phone;
}

export function timeAgo(value: string | null | undefined): string {
  if (!value) return "—";
  const now = new Date();
  const past = new Date(value);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(value);
}

// ---- Phase 5: WhatsApp Templates & Broadcasts ----

export const WA_TEMPLATE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
  paused: "Paused",
  disabled: "Disabled",
};

export const WA_TEMPLATE_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  approved: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  paused: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  disabled: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export const WA_TEMPLATE_CATEGORY_LABELS: Record<string, string> = {
  marketing: "Marketing",
  utility: "Utility",
  authentication: "Authentication",
};

export const WA_TEMPLATE_LANGUAGES: { value: string; label: string }[] = [
  { value: "en_ZA", label: "English (South Africa)" },
  { value: "en", label: "English" },
  { value: "af_ZA", label: "Afrikaans" },
  { value: "zu_ZA", label: "Zulu" },
  { value: "xh_ZA", label: "Xhosa" },
];

export const BROADCAST_CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  sending: "Sending",
  sent: "Sent",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const BROADCAST_CAMPAIGN_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  sending: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  sent: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  cancelled: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export const BROADCAST_SEGMENT_LABELS: Record<string, string> = {
  lost_leads: "Lost Leads",
  carpenters: "Carpenters",
  bulk_buyers: "Bulk Buyers",
  quoted_not_closed: "Quoted (Not Closed)",
  custom: "Custom",
};

export const BROADCAST_RECIPIENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
  failed: "Failed",
  replied: "Replied",
};

export const BROADCAST_RECIPIENT_STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  delivered: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  read: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  replied: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
};

// Opt-out keywords the chatbot should detect (Phase 5 compliance)
export const OPT_OUT_KEYWORDS = [
  "stop",
  "unsubscribe",
  "opt out",
  "opt-out",
  "don't contact me",
  "do not contact me",
  "remove me",
  "take me off",
] as const;

// ---- Phase 2: AI Performance Reporting ----

export const TEST_CATEGORY_LABELS: Record<string, string> = {
  greeting: "Greeting",
  price_lookup: "Price Lookup",
  quote_generation: "Quote Generation",
  branch_banking: "Branch & Banking",
  sales_closing: "Sales Closing",
  objection_handling: "Objection Handling",
  handover: "Handover",
  returning_customer: "Returning Customer",
  adversarial_edge: "Adversarial / Edge",
  new_customer: "New Customer",
  hardware_upsell: "Hardware Upsell",
  sales_simulation: "Sales Simulation",
};

export const TEST_CATEGORY_COLORS: Record<string, string> = {
  greeting: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  price_lookup: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
  quote_generation: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  branch_banking: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
  sales_closing: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  objection_handling: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  handover: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  returning_customer: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  adversarial_edge: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  new_customer: "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
  hardware_upsell: "bg-lime-100 text-lime-700 dark:bg-lime-950 dark:text-lime-300",
  sales_simulation: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-300",
};

export const TEST_RUN_TYPE_LABELS: Record<string, string> = {
  full: "Full Suite",
  smoke: "Smoke Test",
  category: "Category Run",
  scenario: "Single Scenario",
};

// Order categories appear on the AI Performance dashboard
export const TEST_CATEGORY_ORDER = [
  "greeting",
  "price_lookup",
  "quote_generation",
  "branch_banking",
  "sales_closing",
  "objection_handling",
  "handover",
  "returning_customer",
  "adversarial_edge",
  "new_customer",
  "hardware_upsell",
  "sales_simulation",
] as const;

// ---- Phase 2b: Conversation Quality Flags ----

export const QUALITY_FLAG_LABELS: Record<string, string> = {
  greeted: "Greeted",
  quoted: "Quoted",
  close_attempted: "Close Attempted",
  objection_handled: "Objection Handled",
  handed_over: "Handed Over",
  fallback_used: "Fallback Used",
  no_reply: "No Reply",
  image_processed: "Image Processed",
};

export const QUALITY_FLAG_COLORS: Record<string, string> = {
  greeted: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  quoted: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  close_attempted: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  objection_handled: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  handed_over: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  fallback_used: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  no_reply: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  image_processed: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
};

export const QUALITY_SCORE_LABELS: Record<string, string> = {
  excellent: "Excellent (80+)",
  good: "Good (60-79)",
  needs_work: "Needs Work (40-59)",
  poor: "Poor (<40)",
};

// ---------------------------------------------------------------------------
// RBAC / Roles
// ---------------------------------------------------------------------------

export const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  manager: "Sales Manager",
  sales: "Sales Representative",
};

export const ROLE_COLORS: Record<string, string> = {
  owner: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  manager: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  sales: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};

export const ROLE_ORDER: string[] = ["sales", "manager", "owner"];
