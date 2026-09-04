import type {
  CustomerProfile,
  IntelligenceReport,
  Quote,
  QuoteAcceptanceMap,
} from "@/lib/types";

/**
 * Report analytics — pure functions powering the extended Reports page.
 *
 * All time-of-day / day-of-week bucketing is done in South African local time
 * (Africa/Johannesburg) because that is when customers actually message, even
 * though `ai_conversations.created_at` is stored in UTC.
 */

const SAST_TIMEZONE = "Africa/Johannesburg";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HourActivity = {
  hour: number; // 0-23 (SAST)
  label: string; // "00:00" .. "23:00"
  count: number; // customer messages in this hour
  customers: number; // unique customers messaging in this hour
};

export type DayActivity = {
  day: number; // 0 = Monday .. 6 = Sunday
  label: string; // "Mon" .. "Sun"
  count: number;
  customers: number;
};

export type QuotedProduct = {
  name: string;
  type: "board" | "hardware";
  quotes: number; // distinct quotes containing this product
  units: number; // boards needed (boards) or quantity (hardware)
  value: number; // rand value attributable to this product
};

export type ProductMention = {
  label: string;
  mentions: number; // customer messages mentioning it
  customers: number; // unique customers mentioning it
  stocked: boolean;
  note?: string;
};

export type ObjectionStat = {
  tag: string;
  label: string;
  /** Compact label for chart axes (full label used in tables). */
  shortLabel: string;
  count: number; // total objection tag occurrences
  customers: number; // unique customers with this objection
};

export type GrowthOpportunity = {
  area: string;
  title: string;
  detail: string;
  priority: "high" | "medium" | "low";
};

// ---------------------------------------------------------------------------
// Keyword maps
// ---------------------------------------------------------------------------

/**
 * Chat-demand keywords mapped against the HDS price list categories
 * (hds_prices_william). `stocked: false` rows surface products customers ask
 * for that HDS does not carry — these feed the growth-opportunity section.
 * To maintain: add/remove entries as the price list or customer demand changes.
 */
const PRODUCT_MENTION_KEYWORDS: {
  label: string;
  regex: RegExp;
  stocked: boolean;
  note?: string;
}[] = [
  // Stocked — mirrors price list categories
  { label: "Melamine boards", regex: /\bmelamine\b/i, stocked: true },
  { label: "Cut-to-size service", regex: /\bcut(ting)?\b|cut[\s-]?to[\s-]?size/i, stocked: true },
  { label: "Edging", regex: /\bedging\b|edge[\s-]?band/i, stocked: true },
  { label: "Cabinet doors", regex: /\bdoors?\b/i, stocked: true },
  { label: "Chipboard", regex: /\bchip\s?board\b|\bparticle\s?board\b/i, stocked: true },
  { label: "Handles, hinges & runners", regex: /\bhandles?\b|\bhinges?\b|\brunners?\b|\bslides\b/i, stocked: true },
  { label: "Gloss finishes", regex: /\bgloss\b/i, stocked: true },
  { label: "Shelving", regex: /\bshel(ves|f|ving)\b/i, stocked: true },
  { label: "Drawer systems", regex: /\bdrawers?\b/i, stocked: true },
  { label: "Worktops / counter tops", regex: /worktop|counter[\s-]?top/i, stocked: true },
  { label: "MDF boards", regex: /\bmdf\b/i, stocked: true },
  { label: "Ceiling panels", regex: /\bceiling/i, stocked: true },
  { label: "PVC cladding / panels", regex: /\bpvc\b|cladding|wall\s?panel/i, stocked: true },
  { label: "UV boards", regex: /\buv\b/i, stocked: true },
  { label: "Quartz tops", regex: /\bquartz\b/i, stocked: true },
  { label: "Plywood", regex: /\bply\s?wood\b/i, stocked: true },
  { label: "Flatpack cabinets", regex: /flat[\s-]?pack/i, stocked: true },
  { label: "Melawood", regex: /mela\s?wood/i, stocked: true },
  { label: "Veneer", regex: /\bveneer\b/i, stocked: true },
  { label: "Cornices", regex: /\bcornice/i, stocked: true },
  // Not stocked — recurring asks with no price-list match
  {
    label: "Granite tops (real stone)",
    regex: /\bgranite\b(?![-\s]?look)/i,
    stocked: false,
    note: "Only granite-look worktops are stocked — real granite is not carried",
  },
  {
    label: "Laminate flooring",
    regex: /laminate[\s-]?floor|\bflooring\b/i,
    stocked: false,
    note: "HDS sells boards/panels, not installed flooring",
  },
  {
    label: "Cappuccino gloss",
    regex: /\bcappuccino\b/i,
    stocked: false,
    note: "Only Metallic Cappuccino melamine is stocked — no gloss cappuccino",
  },
  {
    label: "Bamboo boards",
    regex: /\bbamboo\b/i,
    stocked: false,
  },
];

const OBJECTION_LABELS: Record<string, string> = {
  logistics: "Delivery / collection logistics",
  uncertainty: "Uncertainty / needs to think",
  third_party: "Third party (spouse / partner / boss)",
  negotiation: "Price negotiation",
  stalling: "Stalling / delaying",
  payment: "Payment / budget concerns",
  timing: "Timing / not ready yet",
  competitor: "Comparing competitors",
  quantity: "Quantity / minimum order",
  browsing: "Just browsing",
  price: "Price too high",
};

/** Compact chart-axis labels for the objection tags above. */
const OBJECTION_SHORT_LABELS: Record<string, string> = {
  logistics: "Logistics",
  uncertainty: "Uncertainty",
  third_party: "Third party",
  negotiation: "Negotiation",
  stalling: "Stalling",
  payment: "Payment",
  timing: "Timing",
  competitor: "Competitor",
  quantity: "Quantity",
  browsing: "Browsing",
  price: "Price",
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ---------------------------------------------------------------------------
// Message activity (hour of day / day of week) — SAST
// ---------------------------------------------------------------------------

export type AnalyticsMessage = {
  phone_number: string | null;
  message_text: string | null;
  created_at: string;
};

/** Format an SAST hour as "HH:00". */
function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

/**
 * Bucket customer messages by hour of day (SAST) within the window.
 * Returns all 24 hours so the chart shows quiet periods too.
 */
export function computeHourActivity(
  messages: AnalyticsMessage[],
  start: Date,
  end: Date
): HourActivity[] {
  const hourFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: SAST_TIMEZONE,
    hour: "numeric",
    hourCycle: "h23",
  });

  const buckets: HourActivity[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: hourLabel(hour),
    count: 0,
    customers: 0,
  }));
  const phonesByHour: Set<string>[] = Array.from({ length: 24 }, () => new Set<string>());

  for (const m of messages) {
    const d = new Date(m.created_at);
    if (isNaN(d.getTime()) || d < start || d > end) continue;
    const hour = Number(hourFmt.format(d));
    if (isNaN(hour) || hour < 0 || hour > 23) continue;
    buckets[hour].count += 1;
    if (m.phone_number) phonesByHour[hour].add(m.phone_number.replace(/^\+/, ""));
  }
  for (let h = 0; h < 24; h++) buckets[h].customers = phonesByHour[h].size;

  return buckets;
}

/**
 * Bucket customer messages by day of week (SAST) within the window.
 * Returns all 7 days (Mon–Sun) so quiet days are visible.
 */
export function computeDayActivity(
  messages: AnalyticsMessage[],
  start: Date,
  end: Date
): DayActivity[] {
  const dayFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: SAST_TIMEZONE,
    weekday: "short",
  });
  const dayIndex: Record<string, number> = {
    Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
  };

  const buckets: DayActivity[] = DAY_LABELS.map((label, day) => ({
    day,
    label,
    count: 0,
    customers: 0,
  }));
  const phonesByDay: Set<string>[] = Array.from({ length: 7 }, () => new Set<string>());

  for (const m of messages) {
    const d = new Date(m.created_at);
    if (isNaN(d.getTime()) || d < start || d > end) continue;
    const idx = dayIndex[dayFmt.format(d)];
    if (idxInvalid(idx)) continue;
    buckets[idx].count += 1;
    if (m.phone_number) phonesByDay[idx].add(m.phone_number.replace(/^\+/, ""));
  }
  for (let i = 0; i < 7; i++) buckets[i].customers = phonesByDay[i].size;

  return buckets;

  function idxInvalid(i: number): boolean {
    return i === undefined || i < 0 || i > 6;
  }
}

// ---------------------------------------------------------------------------
// Product demand from quotes (quote_data)
// ---------------------------------------------------------------------------

type QuoteSections = {
  sections?: { material?: string; boardsNeeded?: number; sectionTotal?: number }[];
  hardwareItems?: { sku?: string; name?: string; quantity?: number; lineTotal?: number }[];
};

/**
 * Aggregate products actually quoted (from quote_data): board materials from
 * `sections` and hardware from `hardwareItems`, ranked by value.
 */
export function computeQuotedProducts(
  quotes: Quote[],
  start: Date,
  end: Date,
  topN = 15
): QuotedProduct[] {
  const boards = new Map<string, { quotes: Set<string>; units: number; value: number }>();
  const hardware = new Map<string, { name: string; quotes: Set<string>; units: number; value: number }>();

  for (const q of quotes) {
    const qd = new Date(q.created_at);
    if (isNaN(qd.getTime()) || qd < start || qd > end) continue;
    const qd2 = q.quote_data as QuoteSections | null;
    if (!qd2) continue;

    for (const s of qd2.sections || []) {
      const material = (s.material || "").trim();
      if (!materialValid(material)) continue;
      const entry = boards.get(material) || { quotes: new Set<string>(), units: 0, value: 0 };
      entry.quotes.add(q.id);
      entry.units += Number(s.boardsNeeded || 0);
      entry.value += Number(s.sectionTotal || 0);
      boards.set(material, entry);
    }

    for (const hw of qd2.hardwareItems || []) {
      const sku = (hw.sku || hw.name || "").trim();
      if (!sku) continue;
      const name = (hw.name || sku).trim();
      const entry =
        hardware.get(sku) || { name, quotes: new Set<string>(), units: 0, value: 0 };
      entry.quotes.add(q.id);
      entry.units += Number(hw.quantity || 0);
      entry.value += Number(hw.lineTotal || 0);
      hardware.set(sku, entry);
    }
  }

  const result: QuotedProduct[] = [];
  for (const [name, e] of boards) {
    result.push({ name, type: "board", quotes: e.quotes.size, units: e.units, value: e.value });
  }
  for (const [sku, e] of hardware) {
    result.push({ name: e.name, type: "hardware", quotes: e.quotes.size, units: e.units, value: e.value });
  }
  return result.sort((a, b) => b.value - a.value).slice(0, topN);

  function materialValid(m: string): boolean {
    return m.length > 0 && m.toLowerCase() !== "unknown";
  }
}

// ---------------------------------------------------------------------------
// Product mentions in chats (price-list mapped)
// ---------------------------------------------------------------------------

/**
 * Count customer messages mentioning each product keyword group within the
 * window. Stocked rows show demand for price-list products; non-stocked rows
 * surface unmet demand.
 */
export function computeProductMentions(
  messages: AnalyticsMessage[],
  start: Date,
  end: Date
): ProductMention[] {
  const counts = PRODUCT_MENTION_KEYWORDS.map((kw) => ({
    ...kw,
    mentions: 0,
    phones: new Set<string>(),
  }));

  for (const m of messages) {
    const d = new Date(m.created_at);
    if (isNaN(d.getTime()) || d < start || d > end) continue;
    const text = m.message_text;
    if (!text) continue;
    for (const kw of counts) {
      if (kw.regex.test(text)) {
        kw.mentions += 1;
        if (m.phone_number) kw.phones.add(m.phone_number.replace(/^\+/, ""));
      }
    }
  }

  return counts
    .map((kw) => ({
      label: kw.label,
      mentions: kw.mentions,
      customers: kw.phones.size,
      stocked: kw.stocked,
      note: kw.note,
    }))
    .sort((a, b) => b.mentions - a.mentions);
}

// ---------------------------------------------------------------------------
// Unstocked product demand (keyword scan + AI intelligence reports)
// ---------------------------------------------------------------------------

/**
 * Products customers asked for that HDS does not stock. Combines:
 *  1. Keyword scan of chat messages (curated list above).
 *  2. `intelligence_reports` (category product_demand) rows flagged
 *     details.status = "not_stocked" by the daily AI monitor.
 */
export function computeUnstockedDemand(
  messages: AnalyticsMessage[],
  reports: IntelligenceReport[],
  start: Date,
  end: Date
): ProductMention[] {
  const keywordRows = computeProductMentions(messages, start, end).filter(
    (r) => !r.stocked && r.mentions > 0
  );

  const byLabel = new Map<string, ProductMention>();
  for (const row of keywordRows) {
    byLabel.set(row.label.toLowerCase(), row);
  }

  for (const r of reports) {
    const details = (r.details || {}) as Record<string, unknown>;
    if (details.status !== "not_stocked") continue;
    const product = String(details.product || "").trim();
    if (!product) continue;
    const key = product.toLowerCase();
    const existing = byLabel.get(key);
    const reportMentions = Number(r.conversation_count || 0);
    if (existing) {
      existing.mentions = Math.max(existing.mentions, reportMentions);
      if (!existing.note && details.closest_alternative) {
        existing.note = `Closest alternative: ${String(details.closest_alternative)}`;
      }
    } else {
      byLabel.set(key, {
        label: product,
        mentions: reportMentions,
        customers: 0,
        stocked: false,
        note: details.closest_alternative
          ? `Closest alternative: ${String(details.closest_alternative)}`
          : undefined,
      });
    }
  }

  return Array.from(byLabel.values()).sort((a, b) => b.mentions - a.mentions);
}

// ---------------------------------------------------------------------------
// Objection analysis
// ---------------------------------------------------------------------------

/**
 * Aggregate objection tags from customer_profiles.objections (all-time —
 * objection tags are not timestamped). Cross-referenced with lead status so
 * the report can show which objections correlate with lost vs won deals.
 */
export function computeObjectionStats(customers: CustomerProfile[]): {
  stats: ObjectionStat[];
  byOutcome: Record<string, number>;
} {
  const tagCounts = new Map<string, { count: number; phones: Set<string> }>();
  const byOutcome: Record<string, number> = {};

  for (const c of customers) {
    if (!c.objections || c.objections.length === 0) continue;
    const uniqueTags = new Set(c.objections);
    for (const tag of uniqueTags) {
      const entry = tagCounts.get(tag) || { count: 0, phones: new Set<string>() };
      entry.count += c.objections.filter((t) => t === tag).length;
      entry.phones.add(c.phone_number.replace(/^\+/, ""));
      tagCounts.set(tag, entry);
    }
    const outcome = c.sale_outcome || "unknown";
    byOutcome[outcome] = (byOutcome[outcome] || 0) + 1;
  }

  const stats: ObjectionStat[] = Array.from(tagCounts.entries())
    .map(([tag, e]) => ({
      tag,
      label: OBJECTION_LABELS[tag] || tag.replace(/_/g, " "),
      shortLabel: OBJECTION_SHORT_LABELS[tag] || tag.replace(/_/g, " "),
      count: e.count,
      customers: e.phones.size,
    }))
    .sort((a, b) => b.count - a.count);

  return { stats, byOutcome };
}

// ---------------------------------------------------------------------------
// Growth opportunities
// ---------------------------------------------------------------------------

export type OpportunityInputs = {
  /** Per-location quote aggregates. `accepted` = quotes customers accepted. */
  quotesByLocation: { location: string; count: number; value: number; accepted: number }[];
  windowQuotes: Quote[];
  acceptance: QuoteAcceptanceMap;
  unstockedDemand: ProductMention[];
  hourActivity: HourActivity[];
  dayActivity: DayActivity[];
  objectionStats: ObjectionStat[];
  totalMessages: number;
};

/**
 * Derive actionable growth opportunities from the report data:
 *  - Stock gaps (products asked for but not stocked)
 *  - High-demand areas with below-average conversion
 *  - Peak-hour staffing coverage
 *  - Dominant objection themes
 *  - Quoted-but-not-accepted customers (nudge campaign)
 */
export function computeGrowthOpportunities(inputs: OpportunityInputs): GrowthOpportunity[] {
  const opportunities: GrowthOpportunity[] = [];

  // 1. Stock gaps — unmet product demand
  for (const row of inputs.unstockedDemand) {
    if (row.mentions < 3) continue;
    opportunities.push({
      area: "Product range",
      title: `Consider stocking: ${row.label}`,
      detail:
        `${row.mentions} customer message${row.mentions === 1 ? "" : "s"} asked for this in the selected period` +
        (row.note ? `. ${row.note}.` : ".") +
        " Evaluate whether adding it (or a closer alternative) would capture this lost demand.",
      priority: row.mentions >= 8 ? "high" : "medium",
    });
  }

  // 2. High-demand areas with below-average quote conversion
  const totalQuotes = inputs.windowQuotes.length;
  const totalAccepted = inputs.windowQuotes.filter((q) => inputs.acceptance[q.id]?.accepted).length;
  const overallRate = totalQuotes > 0 ? totalAccepted / totalQuotes : 0;
  const lowConversionLocations = inputs.quotesByLocation
    .filter((loc) => loc.location !== "Unknown" && loc.count >= 3)
    .map((loc) => ({ ...loc, rate: loc.count > 0 ? loc.accepted / loc.count : 0 }))
    .filter((loc) => loc.rate < overallRate - 0.1)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3); // top 3 by value — avoid flooding the report with small towns
  for (const loc of lowConversionLocations) {
    opportunities.push({
      area: "Geographic",
      title: `Low conversion in ${loc.location}`,
      detail: `${loc.count} quotes worth ${Math.round(loc.value).toLocaleString("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 })} but only ${Math.round(loc.rate * 100)}% accepted (overall ${Math.round(overallRate * 100)}%). Consider a follow-up campaign, local promo, or checking delivery/collection friction for this area.`,
      priority: loc.count >= 8 ? "high" : "medium",
    });
  }

  // 3. Peak-hour staffing coverage
  const hourRows = inputs.hourActivity.filter((h) => h.count > 0);
  if (hourRows.length > 0 && inputs.totalMessages >= 20) {
    const sorted = [...hourRows].sort((a, b) => b.count - a.count);
    const top3 = sorted.slice(0, 3);
    const top3Share = top3.reduce((s, h) => s + h.count, 0) / inputs.totalMessages;
    if (top3Share >= 0.35) {
      const from = top3[top3.length - 1].label;
      const to = hourLabel((top3[0].hour + 1) % 24);
      opportunities.push({
        area: "Operations",
        title: `Peak messaging window: ${top3Share >= 0.45 ? "heavily" : ""} concentrated ${from}–${to}`,
        detail: `${Math.round(top3Share * 100)}% of customer messages arrive in just 3 hours of the day (${top3.map((h) => h.label).join(", ")}). Make sure the AI is monitored and sales staff are available to action handovers in this window.`,
        priority: top3Share >= 0.45 ? "high" : "medium",
      });
    }
  }

  // 4. Dominant objection themes
  const totalObjections = inputs.objectionStats.reduce((s, o) => s + o.count, 0);
  if (inputs.objectionStats.length > 0 && totalObjections >= 5) {
    const top = inputs.objectionStats[0];
    const share = top.count / totalObjections;
    if (share >= 0.25) {
      opportunities.push({
        area: "Sales process",
        title: `Top objection: ${top.label} (${Math.round(share * 100)}% of all objections)`,
        detail: `"${top.label}" is the most common objection across ${top.customers} customer${top.customers === 1 ? "" : "s"}. Build a targeted response/playbook for it (e.g. scripts, guarantees, or pricing options) to lift close rates.`,
        priority: share >= 0.35 ? "high" : "medium",
      });
    }
  }

  // 5. Quoted-but-not-accepted customers — nudge campaign
  const quotedPhones = new Set(
    inputs.windowQuotes.map((q) => q.customer_phone?.replace(/^\+/, "")).filter(Boolean) as string[]
  );
  const acceptedPhones = new Set(
    inputs.windowQuotes
      .filter((q) => inputs.acceptance[q.id]?.accepted)
      .map((q) => q.customer_phone?.replace(/^\+/, ""))
      .filter(Boolean) as string[]
  );
  const notAccepted = quotedPhones.size - acceptedPhones.size;
  if (notAccepted >= 5) {
    opportunities.push({
      area: "Follow-up",
      title: `${notAccepted} quoted customers haven't accepted yet`,
      detail: `${quotedPhones.size} unique customers were quoted in this period but only ${acceptedPhones.size} accepted. Run the Nudge Re-engagement campaign or personal follow-ups on the ${notAccepted} outstanding quotes before they go cold.`,
      priority: notAccepted >= 15 ? "high" : "medium",
    });
  }

  // 6. Quiet day coverage — if a weekday has notably low activity vs the max
  const dayRows = inputs.dayActivity.filter((d) => d.count > 0);
  if (dayRows.length >= 5 && inputs.totalMessages >= 40) {
    const maxDay = [...dayRows].sort((a, b) => b.count - a.count)[0];
    const quietDays = dayRows.filter((d) => d.count < maxDay.count * 0.4);
    if (quietDays.length > 0) {
      opportunities.push({
        area: "Operations",
        title: `Quiet days: ${quietDays.map((d) => d.label).join(", ")}`,
        detail: `These days see under 40% of the busiest day's message volume (${maxDay.label}: ${maxDay.count} messages). Consider scheduling broadcasts/promos on quiet days to level out demand, or reducing weekend staffing if the quiet days are weekends.`,
        priority: "low",
      });
    }
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return opportunities.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}
