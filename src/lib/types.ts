export type CustomerProfile = {
  id: string;
  phone_number: string;
  name: string | null;
  customer_type:
    | "carpenter"
    | "bulk_buyer"
    | "retail"
    | "homeowner"
    | "diy"
    | "unknown"
    | null;
  classification_source: "ai" | "backfill" | "manual" | "unknown" | null;
  classified_at: string | null;
  email: string | null;
  city: string | null;
  total_conversations: number;
  total_quotes: number;
  total_quote_value: number;
  last_quote_date: string | null;
  last_quote_total: number | null;
  payment_status: "none" | "pending" | "paid" | "partial" | "overdue" | null;
  lead_status:
    | "new"
    | "quoting"
    | "quoted"
    | "closing"
    | "objection"
    | "follow_up"
    | "handover"
    | "closed"
    | "lost"
    | null;
  last_interaction_at: string | null;
  first_interaction_at: string | null;
  preferred_branch: string | null;
  preferred_material: string | null;
  sales_notes: string | null;
  objections: string[] | null;
  conversation_summary: string | null;
  close_attempt_count: number;
  last_close_attempt_at: string | null;
  last_close_type: string | null;
  customer_response: string | null;
  objection_count: number;
  sale_outcome: "pending" | "won" | "lost" | "follow_up" | null;
  follow_up_needed: boolean;
  follow_up_date: string | null;
  do_not_contact: boolean;
  do_not_contact_reason: string | null;
  do_not_contact_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Conversation = {
  id: string;
  phone_number: string;
  sender_name: string | null;
  role: "user" | "assistant" | "tool" | "system" | null;
  message_text: string | null;
  image_url: string | null;
  tool_calls: Record<string, unknown> | null;
  tool_results: Record<string, unknown> | null;
  lead_status: string | null;
  customer_type: string | null;
  quote_id: string | null;
  quote_total: number | null;
  conversation_metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type Quote = {
  id: string;
  filename: string;
  created_at: string;
  cutlist_id: string;
  expires_at: string | null;
  quote_number: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  project_name: string | null;
  quote_data: Record<string, unknown> | null;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  status: string | null;
  cutlist_url: string | null;
  expiry_date: string | null;
  trading_as: string | null;
  branch: string | null;
  branch_trading_as: string | null;
  source: string | null;
};

/**
 * Per-customer quote breakdown.
 *
 * Quotes are categorised into:
 *  - converted: has at least one paid invoice
 *  - pending:   has a pending invoice (awaiting payment), no paid invoice
 *  - sent:      quote sent but no invoice yet
 *
 * `total` is the sum of the three categories.
 */
export type CustomerQuoteBreakdown = {
  converted: number;
  pending: number;
  sent: number;
  total: number;
};

/** Map of normalised phone number (no leading "+") → quote breakdown. */
export type CustomerQuoteBreakdownMap = Record<string, CustomerQuoteBreakdown>;

export type Branch = {
  id: number;
  branch_number: number | null;
  trading_as: string | null;
  branch_address: string | null;
  branch_telephone: string | null;
  whatsapp: string | null;
  email_address: string | null;
  created_at: string;
  updated_at: string;
};

export type BankingDetail = {
  id: number;
  fx_branch: string | null;
  account_name: string | null;
  account_number: string | null;
  account_type: string | null;
  created_at: string;
  updated_at: string;
};

export type HdsPrice = {
  ID: number;
  description: string | null;
  price: number | null;
  category: string | null;
  subcategory: string | null;
  color_family: string | null;
  decor_pattern: string | null;
  finish_type: string | null;
  surface_texture: string | null;
  dimensions: string | null;
  face_type: string | null;
  manufacturer: string | null;
  grade: string | null;
};

export type IntelligenceReport = {
  id: string;
  report_date: string;
  category: "competitor" | "pricing" | "product_demand" | "industry_trend";
  insight_summary: string;
  details: Record<string, unknown>;
  severity: "info" | "warning" | "critical";
  conversation_count: number;
  source_phones: string[];
  created_at: string;
};

export type Invoice = {
  id: string;
  invoice_number: string;
  quote_id: string | null;
  quote_number: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  total: number | null;
  status: string | null;
  created_at: string;
};

export type Segment = {
  id: string;
  name: string;
  description: string | null;
  filter_rules: SegmentFilterRules;
  recipient_count: number;
  created_at: string;
  updated_at: string;
};

export type SegmentFilterRules = {
  customer_type?: string[];
  lead_status?: string[];
  city?: string;
  preferred_branch?: string;
  min_total_quote_value?: number;
  min_total_quotes?: number;
  quoted_within_days?: number;
  interacted_within_days?: number;
  has_objections?: boolean;
  sale_outcome?: string[];
  payment_status?: string[];
};

// ---- Phase 5: WhatsApp Templates & Broadcasts ----

export type WaTemplateStatus =
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "paused"
  | "disabled";

export type WaTemplateCategory =
  | "marketing"
  | "utility"
  | "authentication";

export type WaTemplateButton = {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
  text: string;
  url?: string;
  phone_number?: string;
};

export type WaTemplate = {
  id: string;
  name: string;
  category: WaTemplateCategory;
  language: string;
  header_type: string | null;
  header_text: string | null;
  body_text: string;
  footer: string | null;
  buttons: WaTemplateButton[] | null;
  components: Record<string, unknown>[] | null;
  variable_count: number;
  meta_template_id: string | null;
  status: WaTemplateStatus;
  rejection_reason: string | null;
  meta_created_at: string | null;
  last_synced_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type BroadcastSegment = {
  id: string;
  name: string;
  description: string | null;
  segment_type:
    | "lost_leads"
    | "carpenters"
    | "bulk_buyers"
    | "quoted_not_closed"
    | "custom";
  query_condition: Record<string, unknown>;
  recipient_count: number;
  created_at: string;
  updated_at: string;
};

export type BroadcastCampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "failed"
  | "cancelled";

export type BroadcastCampaign = {
  id: string;
  segment_id: string | null;
  template_id: string | null;
  name: string;
  message_template: string | null;
  status: BroadcastCampaignStatus;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  delivered_count: number;
  read_count: number;
  replied_count: number;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  test_mode: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type BroadcastRecipientStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "replied";

export type BroadcastRecipient = {
  id: string;
  campaign_id: string;
  phone: string;
  customer_name: string | null;
  status: BroadcastRecipientStatus;
  wa_message_id: string | null;
  error_code: string | null;
  error_message: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  replied_at: string | null;
  created_at: string;
  updated_at: string;
};

export type HealthStatus = "healthy" | "degraded" | "down" | "unknown";

export type HealthCheck = {
  id: string;
  component: string;
  check_name: string;
  status: HealthStatus;
  latency_ms: number | null;
  message: string | null;
  details: Record<string, unknown> | null;
  checked_at: string;
};

export type HealthComponentSummary = {
  component: string;
  status: HealthStatus;
  latency_ms: number | null;
  message: string | null;
  last_check_at: string;
  details: Record<string, unknown> | null;
  uptime_30d: number;
  total_checks_30d: number;
  healthy_checks_30d: number;
  degraded_checks_30d: number;
  down_checks_30d: number;
};

// ---- Phase 2: AI Performance Reporting ----

export type AiTestRunType = "full" | "smoke" | "category" | "scenario";

export type AiTestRun = {
  id: string;
  run_id: string;
  scenario_id: string;
  scenario_name: string | null;
  category: string;
  passed: boolean;
  skipped: boolean;
  latency_ms: number | null;
  tool_calls: string[] | null;
  assistant_reply_count: number;
  failure_reason: string | null;
  failures: Record<string, unknown>[] | null;
  warnings: Record<string, unknown>[] | null;
  last_reply: string | null;
  phone_number: string | null;
  run_type: AiTestRunType;
  concurrency: number | null;
  created_at: string;
};

export type AiTestRunSummary = {
  id: string;
  run_id: string;
  run_type: AiTestRunType;
  concurrency: number | null;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  pass_rate: number;
  latency_p50_ms: number | null;
  latency_p95_ms: number | null;
  latency_avg_ms: number | null;
  by_category: Record<string, { total: number; passed: number; failed: number }> | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
};

export type AiQualityMetrics = {
  id: string;
  metric_date: string;
  window_hours: number;
  total_conversations: number;
  total_messages: number;
  total_assistant_replies: number;
  no_reply_count: number;
  avg_response_latency_ms: number | null;
  p95_response_latency_ms: number | null;
  tool_call_count: number;
  tool_success_count: number;
  tool_failure_count: number;
  handover_count: number;
  objection_count: number;
  close_attempt_count: number;
  fallback_count: number;
  unique_customers: number;
  new_customers: number;
  returning_customers: number;
  details: Record<string, unknown> | null;
  created_at: string;
};

// ---- Phase 2b: Live Conversation Quality Tracking ----

export type ConversationQualityFlag =
  | "greeted"
  | "quoted"
  | "close_attempted"
  | "objection_handled"
  | "handed_over"
  | "fallback_used"
  | "no_reply"
  | "image_processed";

export type ConversationSummary = {
  phone_number: string;
  customer_name: string | null;
  customer_type: string | null;
  message_count: number;
  user_message_count: number;
  assistant_message_count: number;
  first_message_at: string;
  last_message_at: string;
  lead_status: string | null;
  quote_id: string | null;
  quote_total: number | null;
  quality_flags: ConversationQualityFlag[];
  quality_score: number; // 0-100
  tool_call_count: number;
  has_fallback: boolean;
  response_latency_ms: number | null; // time between first user msg and first assistant reply
};

export type AiMonitorAlert = {
  id: string;
  report_date: string;
  category: string;
  insight_summary: string;
  details: {
    issue_type?: string;
    affected_phones?: string[];
    affected_count?: number;
    suggested_fix?: string;
    severity_detail?: string;
    [key: string]: unknown;
  };
  severity: "info" | "warning" | "critical";
  conversation_count: number;
  source_phones: string[];
  created_at: string;
};

// ---------------------------------------------------------------------------
// RBAC / User Management
// ---------------------------------------------------------------------------

export type UserRole = "owner" | "manager" | "sales";

export type UserWithRole = {
  id: string;
  email: string;
  role: UserRole;
  full_name: string | null;
  branch_id: number | null;
  created_at: string;
  updated_at: string;
  banned_until: string | null;
  is_active: boolean;
};

