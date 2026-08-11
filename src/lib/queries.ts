import { createClient } from "@/lib/supabase/server";
import type {
  CustomerProfile,
  Conversation,
  Quote,
  Branch,
  BankingDetail,
  HdsPrice,
  Invoice,
  IntelligenceReport,
  HealthCheck,
  HealthComponentSummary,
  WaTemplate,
  BroadcastSegment,
  BroadcastCampaign,
  BroadcastRecipient,
  Segment,
  SegmentFilterRules,
} from "@/lib/types";
import { HEALTH_COMPONENT_ORDER } from "@/lib/constants";

export async function getDashboardStats() {
  const supabase = await createClient();

  const [customersRes, quotesRes, conversationsRes] = await Promise.all([
    supabase.from("customer_profiles").select("*"),
    supabase.from("quotes").select("total, created_at, status"),
    supabase
      .from("ai_conversations")
      .select("id, phone_number, sender_name, role, message_text, lead_status, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const customers = (customersRes.data || []) as CustomerProfile[];
  const quotes = (quotesRes.data || []) as Pick<
    Quote,
    "total" | "created_at" | "status"
  >[];
  const recentActivity = (conversationsRes.data || []) as Pick<
    Conversation,
    "id" | "phone_number" | "sender_name" | "role" | "message_text" | "lead_status" | "created_at"
  >[];

  const totalRevenue = quotes.reduce((sum, q) => sum + Number(q.total || 0), 0);
  const activeLeads = customers.filter(
    (c) => c.lead_status !== "closed" && c.lead_status !== "lost"
  ).length;

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const quotesThisWeek = quotes.filter(
    (q) => new Date(q.created_at) >= weekAgo
  ).length;

  const closedLeads = customers.filter(
    (c) => c.lead_status === "closed"
  ).length;
  const conversionRate =
    customers.length > 0
      ? Math.round((closedLeads / customers.length) * 100)
      : 0;

  // Pipeline stages
  const pipeline = [
    "new",
    "quoting",
    "quoted",
    "closing",
    "objection",
    "follow_up",
    "handover",
    "closed",
  ].map((stage) => ({
    stage,
    count: customers.filter((c) => c.lead_status === stage).length,
  }));

  // Monthly revenue (last 6 months)
  const monthlyRevenue: { month: string; revenue: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    const monthName = d.toLocaleString("en-ZA", { month: "short" });
    const revenue = quotes
      .filter((q) => {
        const qd = new Date(q.created_at);
        return qd >= d && qd <= monthEnd;
      })
      .reduce((sum, q) => sum + Number(q.total || 0), 0);
    monthlyRevenue.push({ month: monthName, revenue });
  }

  return {
    totalRevenue,
    activeLeads,
    quotesThisWeek,
    conversionRate,
    totalCustomers: customers.length,
    pipeline,
    monthlyRevenue,
    recentActivity,
  };
}

export async function getCustomers(): Promise<CustomerProfile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_profiles")
    .select("*")
    .order("last_interaction_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data as CustomerProfile[];
}

export async function getCustomerByPhone(
  phone: string
): Promise<CustomerProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_profiles")
    .select("*")
    .eq("phone_number", phone)
    .single();
  if (error) return null;
  return data as CustomerProfile;
}

export async function getConversationsByPhone(
  phone: string,
  limit = 100
): Promise<Conversation[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("*")
    .eq("phone_number", phone)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data as Conversation[];
}

export async function getQuotesByPhone(
  phone: string
): Promise<Quote[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("customer_phone", phone)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Quote[];
}

export async function getAllQuotes(): Promise<Quote[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Quote[];
}

export async function getBranches(): Promise<Branch[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("branches")
    .select("*")
    .order("trading_as", { ascending: true });
  if (error) throw error;
  return data as Branch[];
}

export async function getBankingDetails(): Promise<BankingDetail[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("banking_details")
    .select("*")
    .order("fx_branch", { ascending: true });
  if (error) throw error;
  return data as BankingDetail[];
}

export async function getPrices(): Promise<HdsPrice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hds_prices")
    .select("*")
    .order("description", { ascending: true });
  if (error) throw error;
  return data as HdsPrice[];
}

export async function getInvoices(): Promise<Invoice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Invoice[];
}

export async function getIntelligenceReports(
  days = 30
): Promise<IntelligenceReport[]> {
  const supabase = await createClient();
  const dateFrom = new Date(
    Date.now() - days * 24 * 60 * 60 * 1000
  ).toISOString();
  const { data, error } = await supabase
    .from("intelligence_reports")
    .select("*")
    .gte("report_date", dateFrom.split("T")[0])
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as IntelligenceReport[];
}

export async function getIntelligenceStats() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("intelligence_reports")
    .select("category, severity, report_date, conversation_count");
  if (error) throw error;

  const reports = data || [];
  const total = reports.length;

  const byCategory = (
    ["competitor", "pricing", "product_demand", "industry_trend"] as const
  ).map((cat) => ({
    category: cat,
    count: reports.filter((r) => r.category === cat).length,
  }));

  const bySeverity = (["info", "warning", "critical"] as const).map((sev) => ({
    severity: sev,
    count: reports.filter((r) => r.severity === sev).length,
  }));

  const today = new Date();
  const last7 = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const recentCount = reports.filter(
    (r) => r.report_date >= last7
  ).length;

  return {
    total,
    byCategory,
    bySeverity,
    recentCount,
  };
}

// ============================================================================
// Phase 3 — System Health Monitoring
// ============================================================================

/**
 * Get the latest health check for each component, plus 30-day uptime stats.
 * Returns one summary row per component, ordered by HEALTH_COMPONENT_ORDER.
 */
export async function getHealthSummary(): Promise<HealthComponentSummary[]> {
  const supabase = await createClient();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch all checks from the last 30 days — we compute summaries client-side
  // to avoid needing Postgres window functions over the anon key.
  const { data, error } = await supabase
    .from("system_health_checks")
    .select("id, component, check_name, status, latency_ms, message, details, checked_at")
    .gte("checked_at", thirtyDaysAgo)
    .order("checked_at", { ascending: false });

  if (error) throw error;

  const checks = (data || []) as HealthCheck[];

  // Group by component
  const byComponent = new Map<string, HealthCheck[]>();
  for (const c of checks) {
    const arr = byComponent.get(c.component) || [];
    arr.push(c);
    byComponent.set(c.component, arr);
  }

  // Build summaries for known components, plus any unknown ones that appear
  const allComponents = new Set<string>(HEALTH_COMPONENT_ORDER);
  for (const comp of byComponent.keys()) allComponents.add(comp);

  const summaries: HealthComponentSummary[] = [];

  for (const component of allComponents) {
    const compChecks = byComponent.get(component) || [];
    if (compChecks.length === 0) {
      summaries.push({
        component,
        status: "unknown",
        latency_ms: null,
        message: "No health checks recorded in the last 30 days",
        last_check_at: "",
        details: null,
        uptime_30d: 0,
        total_checks_30d: 0,
        healthy_checks_30d: 0,
        degraded_checks_30d: 0,
        down_checks_30d: 0,
      });
      continue;
    }

    const latest = compChecks[0]; // already sorted DESC by checked_at
    const total = compChecks.length;
    const healthy = compChecks.filter((c) => c.status === "healthy").length;
    const degraded = compChecks.filter((c) => c.status === "degraded").length;
    const down = compChecks.filter((c) => c.status === "down").length;
    // Uptime = (healthy + degraded) / total — degraded counts as "up but impaired"
    const uptime = total > 0 ? Math.round(((healthy + degraded) / total) * 100) : 0;

    summaries.push({
      component,
      status: latest.status,
      latency_ms: latest.latency_ms,
      message: latest.message,
      last_check_at: latest.checked_at,
      details: latest.details,
      uptime_30d: uptime,
      total_checks_30d: total,
      healthy_checks_30d: healthy,
      degraded_checks_30d: degraded,
      down_checks_30d: down,
    });
  }

  // Sort by the canonical component order
  const orderIndex = (comp: string) => {
    const idx = HEALTH_COMPONENT_ORDER.indexOf(
      comp as (typeof HEALTH_COMPONENT_ORDER)[number]
    );
    return idx === -1 ? HEALTH_COMPONENT_ORDER.length : idx;
  };
  summaries.sort((a, b) => orderIndex(a.component) - orderIndex(b.component));

  return summaries;
}

/**
 * Get recent failures (degraded or down) for the failure log table.
 */
export async function getRecentHealthFailures(
  limit = 20
): Promise<HealthCheck[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("system_health_checks")
    .select("id, component, check_name, status, latency_ms, message, details, checked_at")
    .in("status", ["down", "degraded"])
    .order("checked_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as HealthCheck[];
}

/**
 * Get the overall system status: the worst status across all components.
 */
export function getOverallSystemStatus(
  summaries: HealthComponentSummary[]
): "healthy" | "degraded" | "down" | "unknown" {
  if (summaries.length === 0) return "unknown";
  if (summaries.some((s) => s.status === "down")) return "down";
  if (summaries.some((s) => s.status === "degraded")) return "degraded";
  if (summaries.every((s) => s.status === "unknown")) return "unknown";
  return "healthy";
}

/**
 * Get the last N checks for a specific component — used for per-component
 * history / sparkline views.
 */
export async function getComponentHealthHistory(
  component: string,
  limit = 50
): Promise<HealthCheck[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("system_health_checks")
    .select("id, component, check_name, status, latency_ms, message, details, checked_at")
    .eq("component", component)
    .order("checked_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as HealthCheck[];
}

// ============================================================================
// Phase 5 — WhatsApp Templates & Broadcasts
// ============================================================================

export async function getWaTemplates(): Promise<WaTemplate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wa_templates")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as WaTemplate[];
}

export async function getWaTemplate(id: string): Promise<WaTemplate | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wa_templates")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data as WaTemplate;
}

export async function getApprovedWaTemplates(): Promise<WaTemplate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wa_templates")
    .select("*")
    .eq("status", "approved")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data || []) as WaTemplate[];
}

export async function getBroadcastSegments(): Promise<BroadcastSegment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("broadcast_segments")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as BroadcastSegment[];
}

export async function getBroadcastSegment(
  id: string
): Promise<BroadcastSegment | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("broadcast_segments")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data as BroadcastSegment;
}

export async function getBroadcastCampaigns(): Promise<
  Array<BroadcastCampaign & { template_name: string | null; segment_name: string | null }>
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("broadcast_campaigns")
    .select(
      "*, template:wa_templates(name), segment:broadcast_segments(name)"
    )
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data || []).map((row) => {
    const r = row as BroadcastCampaign & {
      template: { name: string } | null;
      segment: { name: string } | null;
    };
    return {
      ...r,
      template_name: r.template?.name ?? null,
      segment_name: r.segment?.name ?? null,
    };
  });
}

export async function getBroadcastCampaign(
  id: string
): Promise<
  (BroadcastCampaign & { template_name: string | null; segment_name: string | null }) | null
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("broadcast_campaigns")
    .select(
      "*, template:wa_templates(name), segment:broadcast_segments(name)"
    )
    .eq("id", id)
    .single();
  if (error) return null;

  const r = data as BroadcastCampaign & {
    template: { name: string } | null;
    segment: { name: string } | null;
  };
  return {
    ...r,
    template_name: r.template?.name ?? null,
    segment_name: r.segment?.name ?? null,
  };
}

export async function getBroadcastRecipients(
  campaignId: string,
  limit = 200
): Promise<BroadcastRecipient[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("broadcast_recipients")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data || []) as BroadcastRecipient[];
}

export async function getBroadcastStats() {
  const supabase = await createClient();
  const [templatesRes, campaignsRes] = await Promise.all([
    supabase.from("wa_templates").select("status"),
    supabase.from("broadcast_campaigns").select(
      "status, total_recipients, sent_count, delivered_count, read_count, replied_count, failed_count"
    ),
  ]);

  const templates = (templatesRes.data || []) as Pick<WaTemplate, "status">[];
  const campaigns = (campaignsRes.data || []) as Pick<
    BroadcastCampaign,
    | "status"
    | "total_recipients"
    | "sent_count"
    | "delivered_count"
    | "read_count"
    | "replied_count"
    | "failed_count"
  >[];

  const templatesByStatus: Record<string, number> = {};
  for (const t of templates) {
    templatesByStatus[t.status] = (templatesByStatus[t.status] || 0) + 1;
  }

  const totals = campaigns.reduce(
    (acc, c) => ({
      total_recipients: acc.total_recipients + (c.total_recipients || 0),
      sent_count: acc.sent_count + (c.sent_count || 0),
      delivered_count: acc.delivered_count + (c.delivered_count || 0),
      read_count: acc.read_count + (c.read_count || 0),
      replied_count: acc.replied_count + (c.replied_count || 0),
      failed_count: acc.failed_count + (c.failed_count || 0),
    }),
    {
      total_recipients: 0,
      sent_count: 0,
      delivered_count: 0,
      read_count: 0,
      replied_count: 0,
      failed_count: 0,
    }
  );

  return {
    totalTemplates: templates.length,
    templatesByStatus,
    totalCampaigns: campaigns.length,
    totals,
  };
}

// ---- Phase 4: Lead Segmentation ----

export async function getSegments(): Promise<Segment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("segments")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data || []) as Segment[];
}

export async function getSegment(id: string): Promise<Segment | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("segments")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data as Segment;
}

/**
 * Apply segment filter rules to a list of customers (in-memory filtering).
 * This mirrors the filter_rules JSONB schema documented in the migration.
 */
export function applySegmentFilter(
  customers: CustomerProfile[],
  rules: SegmentFilterRules
): CustomerProfile[] {
  const now = Date.now();

  return customers.filter((c) => {
    // customer_type filter
    if (rules.customer_type && rules.customer_type.length > 0) {
      if (!rules.customer_type.includes(c.customer_type || "unknown")) {
        return false;
      }
    }

    // lead_status filter
    if (rules.lead_status && rules.lead_status.length > 0) {
      if (!rules.lead_status.includes(c.lead_status || "new")) {
        return false;
      }
    }

    // city filter (ILIKE — case-insensitive substring match)
    if (rules.city) {
      if (!c.city || !c.city.toLowerCase().includes(rules.city.toLowerCase())) {
        return false;
      }
    }

    // preferred_branch filter (ILIKE)
    if (rules.preferred_branch) {
      if (
        !c.preferred_branch ||
        !c.preferred_branch
          .toLowerCase()
          .includes(rules.preferred_branch.toLowerCase())
      ) {
        return false;
      }
    }

    // min_total_quote_value
    if (rules.min_total_quote_value !== undefined) {
      if (Number(c.total_quote_value || 0) < rules.min_total_quote_value) {
        return false;
      }
    }

    // min_total_quotes
    if (rules.min_total_quotes !== undefined) {
      if ((c.total_quotes || 0) < rules.min_total_quotes) {
        return false;
      }
    }

    // quoted_within_days
    if (rules.quoted_within_days !== undefined) {
      if (!c.last_quote_date) return false;
      const cutoff = now - rules.quoted_within_days * 24 * 60 * 60 * 1000;
      if (new Date(c.last_quote_date).getTime() < cutoff) {
        return false;
      }
    }

    // interacted_within_days
    if (rules.interacted_within_days !== undefined) {
      if (!c.last_interaction_at) return false;
      const cutoff =
        now - rules.interacted_within_days * 24 * 60 * 60 * 1000;
      if (new Date(c.last_interaction_at).getTime() < cutoff) {
        return false;
      }
    }

    // has_objections
    if (rules.has_objections === true) {
      if (!c.objections || c.objections.length === 0) {
        return false;
      }
    }

    // sale_outcome filter
    if (rules.sale_outcome && rules.sale_outcome.length > 0) {
      if (!rules.sale_outcome.includes(c.sale_outcome || "pending")) {
        return false;
      }
    }

    // payment_status filter
    if (rules.payment_status && rules.payment_status.length > 0) {
      if (!rules.payment_status.includes(c.payment_status || "none")) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Get per-segment counts and conversion stats for the reports page.
 */
export async function getSegmentStats() {
  const supabase = await createClient();
  const [segmentsRes, customersRes] = await Promise.all([
    supabase.from("segments").select("*").order("name", { ascending: true }),
    supabase.from("customer_profiles").select("*"),
  ]);

  const segments = (segmentsRes.data || []) as Segment[];
  const customers = (customersRes.data || []) as CustomerProfile[];

  const stats = segments.map((seg) => {
    const matched = applySegmentFilter(customers, seg.filter_rules);
    const closed = matched.filter(
      (c) => c.lead_status === "closed" || c.sale_outcome === "won"
    ).length;
    const lost = matched.filter(
      (c) => c.lead_status === "lost" || c.sale_outcome === "lost"
    ).length;
    const conversionRate =
      matched.length > 0
        ? Math.round((closed / matched.length) * 100)
        : 0;
    const totalQuoteValue = matched.reduce(
      (sum, c) => sum + Number(c.total_quote_value || 0),
      0
    );

    return {
      id: seg.id,
      name: seg.name,
      description: seg.description,
      count: matched.length,
      closed,
      lost,
      conversionRate,
      totalQuoteValue,
    };
  });

  return stats;
}

/**
 * Get customer type distribution with counts and conversion rates.
 */
export async function getCustomerTypeStats() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_profiles")
    .select("customer_type, lead_status, sale_outcome, total_quote_value, classification_source");
  if (error) throw error;

  const customers = data || [];
  const types = ["carpenter", "bulk_buyer", "retail", "homeowner", "diy", "unknown"];

  return types.map((type) => {
    const matched = customers.filter((c) => c.customer_type === type);
    const closed = matched.filter(
      (c) => c.lead_status === "closed" || c.sale_outcome === "won"
    ).length;
    const conversionRate =
      matched.length > 0
        ? Math.round((closed / matched.length) * 100)
        : 0;
    const totalQuoteValue = matched.reduce(
      (sum, c) => sum + Number(c.total_quote_value || 0),
      0
    );
    const bySource = {
      ai: matched.filter((c) => c.classification_source === "ai").length,
      backfill: matched.filter((c) => c.classification_source === "backfill").length,
      manual: matched.filter((c) => c.classification_source === "manual").length,
      unknown: matched.filter(
        (c) => !c.classification_source || c.classification_source === "unknown"
      ).length,
    };

    return {
      type,
      count: matched.length,
      closed,
      conversionRate,
      totalQuoteValue,
      bySource,
    };
  });
}
