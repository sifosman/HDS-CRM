import { Brain, TrendingUp, AlertTriangle, DollarSign, Package } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/kpi-card";
import { IntelligenceCard } from "@/components/intelligence-card";
import { DonutChart } from "@/components/charts";
import {
  getIntelligenceReports,
  getIntelligenceStats,
} from "@/lib/queries";
import {
  INTELLIGENCE_CATEGORY_LABELS,
  INTELLIGENCE_CATEGORY_COLORS,
  INTELLIGENCE_SEVERITY_LABELS,
  INTELLIGENCE_SEVERITY_COLORS,
} from "@/lib/constants";

export default async function IntelligencePage() {
  const [reports, stats] = await Promise.all([
    getIntelligenceReports(30),
    getIntelligenceStats(),
  ]);

  const competitorCount = stats.byCategory.find(
    (c) => c.category === "competitor"
  )?.count || 0;
  const pricingCount = stats.byCategory.find(
    (c) => c.category === "pricing"
  )?.count || 0;
  const productCount = stats.byCategory.find(
    (c) => c.category === "product_demand"
  )?.count || 0;
  const trendCount = stats.byCategory.find(
    (c) => c.category === "industry_trend"
  )?.count || 0;

  const categoryChartData = stats.byCategory
    .filter((c) => c.count > 0)
    .map((c) => ({
      name: INTELLIGENCE_CATEGORY_LABELS[c.category] || c.category,
      value: c.count,
    }));

  const severityChartData = stats.bySeverity
    .filter((s) => s.count > 0)
    .map((s) => ({
      name: INTELLIGENCE_SEVERITY_LABELS[s.severity] || s.severity,
      value: s.count,
    }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Business Intelligence</h1>
        <p className="text-sm text-muted-foreground mt-1">
          AI-extracted insights from customer conversations — last 30 days
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Insights"
          value={String(stats.total)}
          icon={Brain}
          description={`${stats.recentCount} in last 7 days`}
        />
        <KpiCard
          title="Competitor Mentions"
          value={String(competitorCount)}
          icon={AlertTriangle}
          description="Customers referencing competitors"
        />
        <KpiCard
          title="Pricing Flags"
          value={String(pricingCount)}
          icon={DollarSign}
          description="Price objections & expectations"
        />
        <KpiCard
          title="Product Demand"
          value={String(productCount)}
          icon={Package}
          description="Product inquiries & trends"
        />
      </div>

      {/* Charts */}
      {(categoryChartData.length > 0 || severityChartData.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {categoryChartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Insights by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <DonutChart data={categoryChartData} />
              </CardContent>
            </Card>
          )}

          {severityChartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Insights by Severity</CardTitle>
              </CardHeader>
              <CardContent>
                <DonutChart data={severityChartData} />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Findings Feed */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Findings</CardTitle>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <div className="text-center py-12">
              <Brain className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                No intelligence reports yet. The AI agent runs daily to analyze
                conversations and extract insights.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <IntelligenceCard key={report.id} report={report} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
