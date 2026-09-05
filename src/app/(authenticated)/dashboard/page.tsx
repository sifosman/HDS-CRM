import { DollarSign, Users, FileText, TrendingUp, CheckCircle2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/kpi-card";
import { RevenueTrendChart, PipelineChart } from "@/components/charts";
import { AccessDeniedBanner } from "@/components/access-denied-banner";
import { getDashboardStats } from "@/lib/queries";
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUS_COLORS,
  formatCurrency,
  timeAgo,
} from "@/lib/constants";

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div className="space-y-6">
      <AccessDeniedBanner />
      <div>
        <h1 className="text-2xl font-heading font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of sales, leads, and recent activity
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          title="Chatbot Revenue"
          value={formatCurrency(stats.totalRevenue)}
          icon={DollarSign}
          description={`From chatbot quotes · ${stats.totalQuotes} total quotes`}
        />
        <KpiCard
          title="Active Leads"
          value={String(stats.activeLeads)}
          icon={Users}
          description={`${stats.totalCustomers} total customers`}
        />
        <KpiCard
          title="Chatbot Quotes This Week"
          value={String(stats.quotesThisWeek)}
          icon={FileText}
          description="Last 7 days"
        />
        <KpiCard
          title="Conversion Rate"
          value={`${stats.conversionRate}%`}
          icon={TrendingUp}
          description={`${stats.acceptedQuotesCount} accepted / ${stats.totalQuotes} quotes · ${stats.conversionRatePerCustomer}% per customer (${stats.uniqueAcceptedCustomers}/${stats.uniqueQuotedCustomers})`}
        />
        <KpiCard
          title="Accepted Quotes"
          value={String(stats.acceptedQuotesCount)}
          icon={CheckCircle2}
          description={`${formatCurrency(stats.acceptedQuotesValue)} total value`}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueTrendChart data={stats.monthlyRevenue} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sales Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <PipelineChart
              data={stats.pipeline.map((p) => ({
                stage: LEAD_STATUS_LABELS[p.stage] || p.stage,
                count: p.count,
              }))}
            />
          </CardContent>
        </Card>
      </div>

      {/* Quote-Age Cohort Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Close Rate by Quote Age</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Quote Age</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Total Quotes</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Accepted</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Rate (per quote)</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Unique Customers</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Rate (per customer)</th>
                </tr>
              </thead>
              <tbody>
                {stats.quoteAgeCohorts.map((cohort) => (
                  <tr key={cohort.label} className="border-b last:border-0">
                    <td className="py-2 px-3 font-medium">{cohort.label}</td>
                    <td className="text-right py-2 px-3">{cohort.totalQuotes}</td>
                    <td className="text-right py-2 px-3">{cohort.acceptedQuotes}</td>
                    <td className="text-right py-2 px-3 font-semibold">{cohort.rate}%</td>
                    <td className="text-right py-2 px-3">{cohort.uniqueCustomers}</td>
                    <td className="text-right py-2 px-3 font-semibold">{cohort.ratePerCustomer}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Fresh quotes (0-3 days) haven&apos;t had time to convert yet. Compare cohorts
            of similar age to see real conversion trends.
          </p>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.recentActivity.length === 0 && (
              <p className="text-sm text-muted-foreground">No recent activity</p>
            )}
            {stats.recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 rounded-lg border p-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {activity.phone_number}
                    </span>
                    {activity.lead_status && (
                      <Badge
                        className={LEAD_STATUS_COLORS[activity.lead_status]}
                        variant="secondary"
                      >
                        {LEAD_STATUS_LABELS[activity.lead_status] ||
                          activity.lead_status}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate mt-1">
                    {activity.message_text?.slice(0, 120) || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {activity.role} · {timeAgo(activity.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
