import { redirect } from "next/navigation";
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
import {
  getCustomers,
  getChatbotQuotes,
  getBranches,
  getSegmentStats,
  getCustomerTypeStats,
} from "@/lib/queries";
import {
  formatCurrency,
  CUSTOMER_TYPE_LABELS,
  CUSTOMER_TYPE_COLORS,
} from "@/lib/constants";
import { FileText, DollarSign, Users, TrendingUp } from "lucide-react";
import type { Quote } from "@/lib/types";

export default async function ReportsPage() {
  const access = await requireRole(["owner", "manager"]);
  if (access.error) redirect("/dashboard?error=access_denied");
  const [customers, chatbotQuotes, branches, segmentStats, typeStats] = await Promise.all([
    getCustomers(),
    getChatbotQuotes(),
    getBranches(),
    getSegmentStats(),
    getCustomerTypeStats(),
  ]);

  const now = new Date();
  const weekStart = new Date(now);
  // getDay() returns 0 for Sunday. Convert to Monday-based index (0=Mon..6=Sun)
  // so the week start is always the Monday of the current week.
  const mondayOffset = (now.getDay() + 6) % 7;
  weekStart.setDate(now.getDate() - mondayOffset);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  // Helper: compute report data from a quote set
  function computeReportData(quotes: Quote[]) {
    const weekQuotes = quotes.filter((q) => {
      const qd = new Date(q.created_at);
      return qd >= weekStart && qd <= weekEnd;
    });

    const totalQuoteValue = weekQuotes.reduce(
      (sum, q) => sum + Number(q.total || 0),
      0
    );
    const avgQuoteSize =
      weekQuotes.length > 0 ? totalQuoteValue / weekQuotes.length : 0;

    const closedLeads = customers.filter(
      (c) => c.lead_status === "closed"
    ).length;
    const conversionRate =
      customers.length > 0
        ? Math.round((closedLeads / customers.length) * 100)
        : 0;

    const newCustomers = customers.filter(
      (c) => c.first_interaction_at && new Date(c.first_interaction_at) >= weekStart
    ).length;
    const returningCustomers = customers.length - newCustomers;

    // Customer type distribution
    const typeDistribution = Object.entries(CUSTOMER_TYPE_LABELS).map(
      ([key, label]) => ({
        name: label,
        value: customers.filter((c) => c.customer_type === key).length,
      })
    );

    // Sales by branch
    const branchSales = branches
      .map((b) => ({
        branch: b.trading_as?.split(" ")[0] || `#${b.id}`,
        value: quotes
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

    // Daily quote activity for the current week (Mon–Sun)
    const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const quotesByDay = dayLabels.map((label, i) => {
      const dayStart = new Date(weekStart);
      dayStart.setDate(weekStart.getDate() + i);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);
      const dayQuotes = quotes.filter((q) => {
        const qd = new Date(q.created_at);
        return qd >= dayStart && qd <= dayEnd;
      });
      return {
        day: label,
        count: dayQuotes.length,
        value: dayQuotes.reduce((sum, q) => sum + Number(q.total || 0), 0),
      };
    });

    // Top quoted customers
    const productMap: Record<string, { count: number; value: number }> = {};
    quotes.forEach((q) => {
      const name = q.customer_name || "Unknown";
      if (!productMap[name]) productMap[name] = { count: 0, value: 0 };
      productMap[name].count++;
      productMap[name].value += Number(q.total || 0);
    });
    const topProducts = Object.entries(productMap)
      .sort((a, b) => b[1].value - a[1].value)
      .slice(0, 10);

    return {
      weekQuotes,
      totalQuoteValue,
      avgQuoteSize,
      conversionRate,
      closedLeads,
      newCustomers,
      returningCustomers,
      typeDistribution,
      branchSales,
      quotesByDay,
      topProducts,
      totalQuotes: quotes.length,
    };
  }

  const chatbotData = computeReportData(chatbotQuotes);

  // Render a report section (shared between both tabs)
  function ReportSection({ data, label }: { data: ReturnType<typeof computeReportData>; label: string }) {
    return (
      <div className="space-y-6">
        {/* Summary KPIs */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Quotes Generated"
            value={String(data.weekQuotes.length)}
            icon={FileText}
            description="This week"
          />
          <KpiCard
            title="Total Quote Value"
            value={formatCurrency(data.totalQuoteValue)}
            icon={DollarSign}
            description="This week"
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
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <KpiCard
            title="Average Quote Size"
            value={formatCurrency(data.avgQuoteSize)}
            icon={DollarSign}
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
              <CardTitle>Daily Quote Activity</CardTitle>
              <p className="text-sm text-muted-foreground">
                Quotes and value per day (this week)
              </p>
            </CardHeader>
            <CardContent>
              {data.quotesByDay.some((d) => d.count > 0) ? (
                <CountBarChart
                  data={data.quotesByDay.map((d) => ({
                    label: d.day,
                    value: d.count,
                  }))}
                  label="Quotes"
                />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No quotes generated this week
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
                Quote value attributed to branches (chatbot quotes may lack
                branch assignment)
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
                      No data available
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
      <div>
        <h1 className="text-2xl font-heading font-bold">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Week of {weekStart.toLocaleDateString("en-ZA")} —{" "}
          {weekEnd.toLocaleDateString("en-ZA")}
        </p>
      </div>

      <ReportSection data={chatbotData} label="Chatbot" />

      {/* Customer Type Breakdown with Conversion (shared — based on all customers) */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Type Segmentation</CardTitle>
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
