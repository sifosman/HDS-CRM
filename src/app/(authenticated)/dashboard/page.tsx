import { DollarSign, Users, FileText, TrendingUp } from "lucide-react";
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Revenue"
          value={formatCurrency(stats.totalRevenue)}
          icon={DollarSign}
          description="From all quotes"
        />
        <KpiCard
          title="Active Leads"
          value={String(stats.activeLeads)}
          icon={Users}
          description={`${stats.totalCustomers} total customers`}
        />
        <KpiCard
          title="Quotes This Week"
          value={String(stats.quotesThisWeek)}
          icon={FileText}
          description="Last 7 days"
        />
        <KpiCard
          title="Conversion Rate"
          value={`${stats.conversionRate}%`}
          icon={TrendingUp}
          description="Closed / total leads"
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
