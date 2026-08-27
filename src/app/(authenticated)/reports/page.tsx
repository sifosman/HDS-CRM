import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireRole } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DonutChart, BranchBarChart, CountBarChart } from "@/components/charts";
import { KpiCard } from "@/components/kpi-card";
import { ReportsDateToggle } from "@/components/reports-date-toggle";
import {
  getCustomers,
  getChatbotQuotes,
  getChatbotQuoteAcceptance,
  getBranches,
  getSegmentStats,
  getCustomerTypeStats,
} from "@/lib/queries";
import {
  formatCurrency,
  CUSTOMER_TYPE_LABELS,
  CUSTOMER_TYPE_COLORS,
} from "@/lib/constants";
import { FileText, DollarSign, Users, TrendingUp, CheckCircle2 } from "lucide-react";
import type { Quote, QuoteAcceptanceMap } from "@/lib/types";

type RangeKey = "weekly" | "monthly" | "yearly" | "custom";

/**
 * Compute the [start, end] window for the selected range.
 * All windows are inclusive of the full end day.
 */
function computeRange(
  range: RangeKey,
  from?: string,
  to?: string
): { start: Date; end: Date } {
  const now = new Date();

  if (range === "monthly") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (range === "yearly") {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (range === "custom") {
    const start = from ? new Date(from + "T00:00:00") : new Date(now);
    const end = to ? new Date(to + "T23:59:59.999") : new Date(now);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      // Fall back to current week on bad input
      const mondayOffset = (now.getDay() + 6) % 7;
      const ws = new Date(now);
      ws.setDate(now.getDate() - mondayOffset);
      ws.setHours(0, 0, 0, 0);
      const we = new Date(ws);
      we.setDate(ws.getDate() + 6);
      we.setHours(23, 59, 59, 999);
      return { start: ws, end: we };
    }
    if (end < start) {
      // Swap if reversed
      return { start: end, end: start };
    }
    return { start, end };
  }

  // Default: weekly (Mon–Sun of current week)
  const mondayOffset = (now.getDay() + 6) % 7;
  const start = new Date(now);
  start.setDate(now.getDate() - mondayOffset);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Build the activity buckets for the chart based on the range span.
 *  - ≤ 14 days  → daily buckets
 *  - ≤ 90 days  → weekly buckets
 *  - otherwise  → monthly buckets
 */
function buildActivityBuckets(
  start: Date,
  end: Date
): { label: string; count: number; value: number; bucketStart: Date; bucketEnd: Date }[] {
  const spanDays = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;

  if (spanDays <= 14) {
    // Daily buckets
    const buckets: { label: string; count: number; value: number; bucketStart: Date; bucketEnd: Date }[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      const dayEnd = new Date(cursor);
      dayEnd.setHours(23, 59, 59, 999);
      buckets.push({
        label: cursor.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric" }),
        count: 0,
        value: 0,
        bucketStart: new Date(cursor),
        bucketEnd: dayEnd,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return buckets;
  }

  if (spanDays <= 90) {
    // Weekly buckets (Mon–Sun), aligned to the start date
    const buckets: { label: string; count: number; value: number; bucketStart: Date; bucketEnd: Date }[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      const weekEnd = new Date(cursor);
      weekEnd.setDate(cursor.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      const cap = weekEnd > end ? new Date(end) : weekEnd;
      buckets.push({
        label: `${cursor.toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}`,
        count: 0,
        value: 0,
        bucketStart: new Date(cursor),
        bucketEnd: cap,
      });
      cursor.setDate(cursor.getDate() + 7);
    }
    return buckets;
  }

  // Monthly buckets
  const buckets: { label: string; count: number; value: number; bucketStart: Date; bucketEnd: Date }[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);
    const cap = monthEnd > end ? new Date(end) : monthEnd;
    const bucketStart = cursor < start ? new Date(start) : new Date(cursor);
    buckets.push({
      label: cursor.toLocaleDateString("en-ZA", { month: "short", year: "2-digit" }),
      count: 0,
      value: 0,
      bucketStart,
      bucketEnd: cap,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return buckets;
}

function rangeLabel(range: RangeKey): string {
  switch (range) {
    case "weekly":
      return "This week";
    case "monthly":
      return "This month";
    case "yearly":
      return "This year";
    case "custom":
      return "Custom range";
  }
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const access = await requireRole(["owner", "manager"]);
  if (access.error) redirect("/dashboard?error=access_denied");

  const sp = await searchParams;
  const range = (sp.range as RangeKey) || "weekly";
  const validRange: RangeKey = ["weekly", "monthly", "yearly", "custom"].includes(range)
    ? range
    : "weekly";

  const { start: rangeStart, end: rangeEnd } = computeRange(
    validRange,
    sp.from,
    sp.to
  );

  const [customers, chatbotQuotes, branches, segmentStats, typeStats] = await Promise.all([
    getCustomers(),
    getChatbotQuotes(),
    getBranches(),
    getSegmentStats(),
    getCustomerTypeStats(),
  ]);

  // Derive customer-acceptance for chatbot quotes (keyword + lead-stage heuristic)
  const acceptance = await getChatbotQuoteAcceptance(chatbotQuotes);

  // Helper: compute report data from a quote set, filtered to the selected window
  function computeReportData(quotes: Quote[], acceptanceMap: QuoteAcceptanceMap) {
    const windowQuotes = quotes.filter((q) => {
      const qd = new Date(q.created_at);
      return qd >= rangeStart && qd <= rangeEnd;
    });

    const totalQuoteValue = windowQuotes.reduce(
      (sum, q) => sum + Number(q.total || 0),
      0
    );
    const avgQuoteSize =
      windowQuotes.length > 0 ? totalQuoteValue / windowQuotes.length : 0;

    // Customer-accepted quotes within the window (derived from conversation
    // analysis + lead stage, same heuristic as the dashboard/quotes pages)
    const acceptedWindowQuotes = windowQuotes.filter(
      (q) => acceptanceMap[q.id]?.accepted
    );
    const acceptedQuotesCount = acceptedWindowQuotes.length;
    const acceptedQuotesValue = acceptedWindowQuotes.reduce(
      (sum, q) => sum + Number(q.total || 0),
      0
    );

    // Customers whose first interaction falls inside the window
    const newCustomers = customers.filter(
      (c) =>
        c.first_interaction_at &&
        new Date(c.first_interaction_at) >= rangeStart &&
        new Date(c.first_interaction_at) <= rangeEnd
    ).length;
    const returningCustomers = Math.max(0, customers.length - newCustomers);

    const closedLeads = customers.filter(
      (c) => c.lead_status === "closed"
    ).length;
    const conversionRate =
      customers.length > 0
        ? Math.round((closedLeads / customers.length) * 100)
        : 0;

    // Customer type distribution (all customers — type doesn't change by window)
    const typeDistribution = Object.entries(CUSTOMER_TYPE_LABELS).map(
      ([key, label]) => ({
        name: label,
        value: customers.filter((c) => c.customer_type === key).length,
      })
    );

    // Sales by branch (within the window)
    const branchSales = branches
      .map((b) => ({
        branch: b.trading_as?.split(" ")[0] || `#${b.id}`,
        value: windowQuotes
          .filter(
            (q) =>
              q.branch_trading_as === b.trading_as ||
              q.trading_as === b.trading_as
          )
          .reduce((sum, q) => sum + Number(q.total || 0), 0),
      }))
      .filter((b) => b.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 15);

    // Activity buckets (granularity adapts to span)
    const buckets = buildActivityBuckets(rangeStart, rangeEnd);
    for (const q of quotes) {
      const qd = new Date(q.created_at);
      for (const b of buckets) {
        if (qd >= b.bucketStart && qd <= b.bucketEnd) {
          b.count += 1;
          b.value += Number(q.total || 0);
          break;
        }
      }
    }
    const activityData = buckets.map((b) => ({
      label: b.label,
      count: b.count,
      value: b.value,
    }));

    // Top quoted customers (within the window)
    const productMap: Record<string, { count: number; value: number }> = {};
    windowQuotes.forEach((q) => {
      const name = q.customer_name || "Unknown";
      if (!productMap[name]) productMap[name] = { count: 0, value: 0 };
      productMap[name].count++;
      productMap[name].value += Number(q.total || 0);
    });
    const topProducts = Object.entries(productMap)
      .sort((a, b) => b[1].value - a[1].value)
      .slice(0, 10);

    return {
      windowQuotes,
      totalQuoteValue,
      avgQuoteSize,
      conversionRate,
      closedLeads,
      newCustomers,
      returningCustomers,
      typeDistribution,
      branchSales,
      activityData,
      topProducts,
      totalQuotes: quotes.length,
      acceptedQuotesCount,
      acceptedQuotesValue,
    };
  }

  const chatbotData = computeReportData(chatbotQuotes, acceptance);

  function ReportSection({
    data,
    label,
  }: {
    data: ReturnType<typeof computeReportData>;
    label: string;
  }) {
    return (
      <div className="space-y-6">
        {/* Summary KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard
            title="Quotes Generated"
            value={String(data.windowQuotes.length)}
            icon={FileText}
            description={rangeLabel(validRange)}
          />
          <KpiCard
            title="Total Quote Value"
            value={formatCurrency(data.totalQuoteValue)}
            icon={DollarSign}
            description={rangeLabel(validRange)}
          />
          <KpiCard
            title="Conversion Rate"
            value={`${data.conversionRate}%`}
            icon={TrendingUp}
            description={`${data.closedLeads} closed / ${customers.length} total`}
          />
          <KpiCard
            title="New Customers"
            value={String(data.newCustomers)}
            icon={Users}
            description={`${data.returningCustomers} returning`}
          />
          <KpiCard
            title="Accepted Quotes"
            value={String(data.acceptedQuotesCount)}
            icon={CheckCircle2}
            description={`${formatCurrency(data.acceptedQuotesValue)} value · ${rangeLabel(validRange)}`}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <KpiCard
            title="Average Quote Size"
            value={formatCurrency(data.avgQuoteSize)}
            icon={DollarSign}
            description={rangeLabel(validRange)}
          />
          <KpiCard
            title={`Total ${label} Quotes`}
            value={String(data.totalQuotes)}
            icon={FileText}
            description="All time"
          />
        </div>

        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Quote Activity</CardTitle>
              <p className="text-sm text-muted-foreground">
                Quotes and value per {validRange === "weekly" ? "day" : validRange === "monthly" ? "week" : "month"}
                {" "}
                ({rangeLabel(validRange).toLowerCase()})
              </p>
            </CardHeader>
            <CardContent>
              {data.activityData.some((d) => d.count > 0) ? (
                <CountBarChart
                  data={data.activityData.map((d) => ({
                    label: d.label,
                    value: d.count,
                  }))}
                  label="Quotes"
                />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No quotes generated in this period
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lead Source Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {data.typeDistribution.filter((t) => t.value > 0).length > 1 ? (
                <DonutChart
                  data={data.typeDistribution.filter((t) => t.value > 0)}
                />
              ) : (
                <div className="space-y-3">
                  <DonutChart
                    data={data.typeDistribution.filter((t) => t.value > 0)}
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    All customers are classified as a single type. Customer
                    type classification will diversify as the AI bot gathers
                    more conversation data.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sales by Branch — only show if branch data exists */}
        {data.branchSales.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Sales by Branch</CardTitle>
              <p className="text-sm text-muted-foreground">
                Quote value attributed to branches ({rangeLabel(validRange).toLowerCase()})
              </p>
            </CardHeader>
            <CardContent>
              <BranchBarChart data={data.branchSales} />
            </CardContent>
          </Card>
        )}

        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle>Top Quoted Customers</CardTitle>
            <p className="text-sm text-muted-foreground">
              {rangeLabel(validRange)}
            </p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Quote Count</TableHead>
                  <TableHead className="text-right">Total Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      No data available for this period
                    </TableCell>
                  </TableRow>
                ) : (
                  data.topProducts.map(([name, stats]) => (
                    <TableRow key={name}>
                      <TableCell className="font-medium">{name}</TableCell>
                      <TableCell className="text-right">{stats.count}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(stats.value)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {rangeStart.toLocaleDateString("en-ZA")} —{" "}
            {rangeEnd.toLocaleDateString("en-ZA")}
          </p>
        </div>
      </div>

      <Suspense fallback={<div className="h-10 rounded-lg bg-muted animate-pulse" />}>
        <ReportsDateToggle />
      </Suspense>

      <ReportSection data={chatbotData} label="Chatbot" />

      {/* Customer Type Breakdown with Conversion (shared — based on all customers) */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Type Segmentation</CardTitle>
          <p className="text-sm text-muted-foreground">
            All-time customer classification (not filtered by date range)
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Count</TableHead>
                <TableHead className="text-right">Closed</TableHead>
                <TableHead className="text-right">Conversion</TableHead>
                <TableHead className="text-right">Quote Value</TableHead>
                <TableHead>Classification Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {typeStats.map((stat) => (
                <TableRow key={stat.type}>
                  <TableCell>
                    <Badge className={CUSTOMER_TYPE_COLORS[stat.type] || CUSTOMER_TYPE_COLORS.unknown}>
                      {CUSTOMER_TYPE_LABELS[stat.type] || stat.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">{stat.count}</TableCell>
                  <TableCell className="text-right">{stat.closed}</TableCell>
                  <TableCell className="text-right">{stat.conversionRate}%</TableCell>
                  <TableCell className="text-right">{formatCurrency(stat.totalQuoteValue)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    AI: {stat.bySource.ai} · Backfill: {stat.bySource.backfill} · Manual: {stat.bySource.manual} · Unknown: {stat.bySource.unknown}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Saved Segment Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Saved Segment Performance</CardTitle>
          <p className="text-sm text-muted-foreground">
            All-time segment performance (not filtered by date range)
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Segment</TableHead>
                <TableHead className="text-right">Recipients</TableHead>
                <TableHead className="text-right">Closed</TableHead>
                <TableHead className="text-right">Lost</TableHead>
                <TableHead className="text-right">Conversion</TableHead>
                <TableHead className="text-right">Quote Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {segmentStats.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No saved segments. Create segments on the Segments page.
                  </TableCell>
                </TableRow>
              )}
              {segmentStats.map((stat) => (
                <TableRow key={stat.id}>
                  <TableCell className="font-medium">
                    {stat.name}
                    {stat.description && (
                      <span className="block text-xs text-muted-foreground font-normal">
                        {stat.description}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">{stat.count}</TableCell>
                  <TableCell className="text-right">{stat.closed}</TableCell>
                  <TableCell className="text-right">{stat.lost}</TableCell>
                  <TableCell className="text-right">{stat.conversionRate}%</TableCell>
                  <TableCell className="text-right">{formatCurrency(stat.totalQuoteValue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
