import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KpiCard } from "@/components/kpi-card";
import {
  PassRateTrendChart,
  CategoryPassRateChart,
  LatencyDistributionChart,
  QualityTrendChart,
} from "@/components/charts";
import {
  getAiPerformanceScore,
  getAiTestRunSummaries,
  getLatestAiTestRunSummary,
  getAiTestCategoryStats,
  getAiTestLatencyDistribution,
  getRecentAiTestFailures,
  getAiProductionStats,
  getAiQualityMetrics,
  getRecentConversationSummaries,
  getAiMonitorAlerts,
  getAiQualityTrend,
} from "@/lib/queries";
import {
  TEST_CATEGORY_LABELS,
  TEST_CATEGORY_COLORS,
  TEST_RUN_TYPE_LABELS,
  QUALITY_FLAG_LABELS,
  QUALITY_FLAG_COLORS,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_COLORS,
  formatPhone,
  timeAgo,
  formatCurrency,
} from "@/lib/constants";
import {
  Bot,
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquare,
  TrendingUp,
  Target,
  AlertTriangle,
  Activity,
  Zap,
  Eye,
  Lightbulb,
  Wrench,
} from "lucide-react";

const GRADE_COLORS: Record<string, string> = {
  A: "text-green-600 dark:text-green-400",
  B: "text-blue-600 dark:text-blue-400",
  C: "text-amber-600 dark:text-amber-400",
  D: "text-orange-600 dark:text-orange-400",
  F: "text-red-600 dark:text-red-400",
};

const GRADE_BG: Record<string, string> = {
  A: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800",
  B: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
  C: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
  D: "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800",
  F: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800",
};

export default async function AiReportsPage() {
  const access = await requireRole(["owner", "manager"]);
  if (access.error) redirect("/dashboard?error=access_denied");
  const [
    score,
    runSummaries,
    latestRun,
    categoryStats,
    latencyDist,
    recentFailures,
    prodStats,
    qualityMetrics,
    conversationSummaries,
    monitorAlerts,
    qualityTrend,
  ] = await Promise.all([
    getAiPerformanceScore(),
    getAiTestRunSummaries(15),
    getLatestAiTestRunSummary(),
    getAiTestCategoryStats(5),
    getAiTestLatencyDistribution(),
    getRecentAiTestFailures(15),
    getAiProductionStats(),
    getAiQualityMetrics(30),
    getRecentConversationSummaries(20),
    getAiMonitorAlerts(30),
    getAiQualityTrend(30),
  ]);

  const hasTestData = score.hasTestData;
  const hasProductionData = score.hasProductionData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <Bot className="h-6 w-6" />
          AI Performance Reports
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Real-time view of how the AI sales assistant is performing against standards
        </p>
      </div>

      {/* AI Performance Score — Hero Card */}
      <Card className={GRADE_BG[score.grade] || ""}>
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6">
            {/* Score circle */}
            <div className="flex items-center gap-4">
              <div className="relative flex items-center justify-center">
                <div className={`text-5xl font-bold ${GRADE_COLORS[score.grade]}`}>
                  {score.grade}
                </div>
              </div>
              <div>
                <div className="text-4xl font-bold font-heading">
                  {score.score}
                  <span className="text-xl text-muted-foreground">/100</span>
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  {score.label}
                </p>
              </div>
            </div>

            {/* Score components */}
            <div className="flex-1 w-full space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Score Breakdown
              </h3>
              {score.components.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No data available yet. Run the test harness and start conversations to generate a score.
                </p>
              )}
              {score.components.map((comp) => (
                <div key={comp.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium flex items-center gap-2">
                      {comp.passing ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      )}
                      {comp.name}
                      <span className="text-muted-foreground text-xs">
                        (weight: {comp.weight}%)
                      </span>
                    </span>
                    <span className="text-muted-foreground">
                      {comp.value}% / {comp.target}% target
                    </span>
                  </div>
                  <Progress value={comp.value} className="h-2" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data source indicators */}
      {(!hasTestData || !hasProductionData) && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4 text-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium">Partial data available</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                {!hasTestData && (
                  <li>
                    <strong>No test runs yet.</strong> Run the chatbot test harness
                    (<code className="text-xs">node runner.js</code> in <code className="text-xs">Chatbot Tests/harness/</code>)
                    to populate test suite results.
                  </li>
                )}
                {!hasProductionData && (
                  <li>
                    <strong>No production conversations yet.</strong> Production quality
                    metrics will appear once the AI bot has conversations in Supabase.
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Production Quality KPIs */}
      <div>
        <h2 className="text-lg font-heading font-semibold mb-3 flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Live Production Quality
          <span className="text-sm font-normal text-muted-foreground">
            (real customers only — test numbers excluded)
          </span>
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Response Rate"
            value={prodStats.uniqueCustomers > 0 ? `${prodStats.responseRate}%` : "—"}
            icon={MessageSquare}
            description={
              prodStats.uniqueCustomers > 0
                ? `${prodStats.noReplyCount} of ${prodStats.uniqueCustomers} customers unanswered`
                : "No real customer data yet"
            }
          />
          <KpiCard
            title="Unique Customers"
            value={String(prodStats.uniqueCustomers)}
            icon={Target}
            description={`${prodStats.userMessages} customer · ${prodStats.assistantMessages} bot messages`}
          />
          <KpiCard
            title="Tool Calls"
            value={String(prodStats.toolCallCount)}
            icon={Zap}
            description={`${prodStats.quoteGeneratedCount} quote generations`}
          />
          <KpiCard
            title="Active Leads"
            value={String(prodStats.activeLeads)}
            icon={TrendingUp}
            description={`${prodStats.closedCount} closed · ${prodStats.lostCount} lost`}
          />
        </div>
      </div>

      {/* Lead Status Pipeline */}
      <Card>
        <CardHeader>
          <CardTitle>AI Lead Pipeline</CardTitle>
          <CardDescription>
            Lead status distribution from AI-handled conversations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {Object.keys(prodStats.leadStatusCounts).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No lead status data available
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead Status</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead className="text-right">% of Total</TableHead>
                  <TableHead>Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(prodStats.leadStatusCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([status, count]) => {
                    const pct =
                      prodStats.uniqueCustomers > 0
                        ? Math.round((count / prodStats.uniqueCustomers) * 100)
                        : 0;
                    return (
                      <TableRow key={status}>
                        <TableCell className="font-medium capitalize">{status}</TableCell>
                        <TableCell className="text-right">{count}</TableCell>
                        <TableCell className="text-right">{pct}%</TableCell>
                        <TableCell className="w-40">
                          <Progress value={pct} className="h-2" />
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Test Suite Results */}
      <div>
        <h2 className="text-lg font-heading font-semibold mb-3 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" />
          Test Suite Performance
          <span className="text-sm font-normal text-muted-foreground">
            (automated scenario tests against live bot)
          </span>
        </h2>

        {/* Latest run KPIs */}
        {latestRun ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4">
              <KpiCard
                title="Latest Run Pass Rate"
                value={`${latestRun.pass_rate}%`}
                icon={CheckCircle2}
                description={`${latestRun.passed}/${latestRun.total} scenarios passed`}
              />
              <KpiCard
                title="Run Type"
                value={TEST_RUN_TYPE_LABELS[latestRun.run_type] || latestRun.run_type}
                icon={Bot}
                description={`${latestRun.total} scenarios · Concurrency: ${latestRun.concurrency ?? "—"}`}
              />
              <KpiCard
                title="P95 Latency"
                value={latestRun.latency_p95_ms ? `${(latestRun.latency_p95_ms / 1000).toFixed(1)}s` : "—"}
                icon={Clock}
                description={`P50: ${latestRun.latency_p50_ms ? `${(latestRun.latency_p50_ms / 1000).toFixed(1)}s` : "—"}`}
              />
              <KpiCard
                title="Failed Scenarios"
                value={String(latestRun.failed)}
                icon={XCircle}
                description={latestRun.failed === 0 ? "All passing" : `${latestRun.failed} failure(s)`}
              />
            </div>

            {/* Pass rate trend + Category breakdown */}
            <div className="grid gap-4 lg:grid-cols-2 mb-4">
              <Card>
                <CardHeader>
                  <CardTitle>Pass Rate Trend</CardTitle>
                  <CardDescription>
                    Last {runSummaries.length} runs (excludes single-scenario runs)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {runSummaries.length > 0 ? (
                    <PassRateTrendChart data={runSummaries} />
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No run history yet
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Pass Rate by Category</CardTitle>
                  <CardDescription>
                    Smoke test runs (cover all core categories). Hover for details.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CategoryPassRateChart
                    data={categoryStats.map((s) => ({
                      category: TEST_CATEGORY_LABELS[s.category] || s.category,
                      passRate: s.passRate,
                      total: s.total,
                      passed: s.passed,
                      runCount: s.runCount,
                    }))}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Category detail table */}
            <Card className="mb-4">
              <CardHeader>
                <CardTitle>Category Detail</CardTitle>
                <CardDescription>
                  Per-category pass rates and latency (aggregated from smoke test runs)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Runs</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Passed</TableHead>
                      <TableHead className="text-right">Failed</TableHead>
                      <TableHead className="text-right">Pass Rate</TableHead>
                      <TableHead className="text-right">Avg Latency</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoryStats
                      .sort((a, b) => {
                        // Sort: categories with data first (by pass rate), then no-data categories
                        if (a.total === 0 && b.total > 0) return 1;
                        if (a.total > 0 && b.total === 0) return -1;
                        return b.passRate - a.passRate;
                      })
                      .map((stat) => (
                        <TableRow key={stat.category}>
                          <TableCell>
                            <Badge
                              className={TEST_CATEGORY_COLORS[stat.category] || ""}
                            >
                              {TEST_CATEGORY_LABELS[stat.category] || stat.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {stat.runCount || 0}
                          </TableCell>
                          <TableCell className="text-right">{stat.total}</TableCell>
                          <TableCell className="text-right text-green-600 dark:text-green-400">
                            {stat.passed}
                          </TableCell>
                          <TableCell className="text-right text-red-600 dark:text-red-400">
                            {stat.failed}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {stat.total > 0 ? `${stat.passRate}%` : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {stat.avgLatencyMs
                              ? `${(stat.avgLatencyMs / 1000).toFixed(1)}s`
                              : "—"}
                          </TableCell>
                          <TableCell>
                            {stat.total === 0 ? (
                              <span className="text-xs text-muted-foreground">No data</span>
                            ) : stat.passRate >= 90 ? (
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
                                Passing
                              </Badge>
                            ) : stat.passRate >= 70 ? (
                              <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                                At Risk
                              </Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                                Failing
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Latency distribution */}
            <Card className="mb-4">
              <CardHeader>
                <CardTitle>Latency Distribution</CardTitle>
                <CardDescription>Latest run — response time buckets</CardDescription>
              </CardHeader>
              <CardContent>
                {latencyDist.length > 0 ? (
                  <LatencyDistributionChart data={latencyDist} />
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No latency data available
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-medium text-lg mb-1">No test runs yet</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Run the chatbot test harness to populate test suite results.
                The harness is located in <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                Chatbot Tests/harness/</code> — execute{" "}
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                node runner.js</code> to start a full test run.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Test Failures */}
      {recentFailures.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              Recent Test Failures
            </CardTitle>
            <CardDescription>
              Latest {recentFailures.length} failed scenarios across all runs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Scenario</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Failure Reason</TableHead>
                  <TableHead className="text-right">Latency</TableHead>
                  <TableHead>Run Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentFailures.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">
                      {f.scenario_id}
                      {f.scenario_name && (
                        <span className="block text-xs text-muted-foreground font-normal">
                          {f.scenario_name}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={TEST_CATEGORY_COLORS[f.category] || ""}>
                        {TEST_CATEGORY_LABELS[f.category] || f.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                      {f.failure_reason || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {f.latency_ms ? `${(f.latency_ms / 1000).toFixed(1)}s` : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(f.created_at).toLocaleString("en-ZA", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Quality Metrics History (if available) */}
      {qualityMetrics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Quality Metrics History</CardTitle>
            <CardDescription>
              Aggregated quality snapshots from the last 30 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Conversations</TableHead>
                  <TableHead className="text-right">Messages</TableHead>
                  <TableHead className="text-right">No Reply</TableHead>
                  <TableHead className="text-right">Avg Latency</TableHead>
                  <TableHead className="text-right">Tool Success</TableHead>
                  <TableHead className="text-right">Handovers</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {qualityMetrics.slice(-10).reverse().map((m) => {
                  const toolSuccessRate =
                    m.tool_call_count > 0
                      ? Math.round((m.tool_success_count / m.tool_call_count) * 100)
                      : 0;
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">
                        {new Date(m.metric_date).toLocaleDateString("en-ZA")}
                      </TableCell>
                      <TableCell className="text-right">{m.total_conversations}</TableCell>
                      <TableCell className="text-right">{m.total_messages}</TableCell>
                      <TableCell className="text-right">{m.no_reply_count}</TableCell>
                      <TableCell className="text-right">
                        {m.avg_response_latency_ms
                          ? `${(m.avg_response_latency_ms / 1000).toFixed(1)}s`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">{toolSuccessRate}%</TableCell>
                      <TableCell className="text-right">{m.handover_count}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* AI Monitor Alerts */}
      {monitorAlerts.length > 0 && (
        <div>
          <h2 className="text-lg font-heading font-semibold mb-3 flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            AI Monitor Alerts
            <span className="text-sm font-normal text-muted-foreground">
              ({monitorAlerts.length} in last 30 days)
            </span>
          </h2>
          <div className="space-y-3">
            {monitorAlerts.slice(0, 10).map((alert) => (
              <Card
                key={alert.id}
                className={
                  alert.severity === "critical"
                    ? "border-l-4 border-l-red-500"
                    : alert.severity === "warning"
                      ? "border-l-4 border-l-amber-500"
                      : "border-l-4 border-l-blue-500"
                }
              >
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          className={
                            alert.severity === "critical"
                              ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                              : alert.severity === "warning"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                          }
                        >
                          {alert.severity}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(alert.created_at).toLocaleString("en-ZA", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {alert.details.affected_count && (
                          <span className="text-xs text-muted-foreground">
                            · {alert.details.affected_count} conversation(s) affected
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium">{alert.insight_summary}</p>
                      {alert.details.suggested_fix && (
                        <div className="flex items-start gap-2 mt-2 p-3 rounded-lg bg-muted/50 border">
                          <Wrench className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                              Suggested Fix
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {alert.details.suggested_fix as string}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Quality Trend Charts (from ai_quality_metrics) */}
      {qualityTrend.length > 1 && (
        <div>
          <h2 className="text-lg font-heading font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Quality Trends (Daily Snapshots)
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Response Rate Trend</CardTitle>
                <CardDescription>% of conversations that got a reply</CardDescription>
              </CardHeader>
              <CardContent>
                <QualityTrendChart
                  data={qualityTrend.map((m) => ({
                    ...m,
                    response_rate:
                      m.total_conversations > 0
                        ? Math.round(
                            ((m.total_conversations - m.no_reply_count) /
                              m.total_conversations) *
                              100
                          )
                        : 0,
                  }))}
                  dataKey="response_rate"
                  label="Response Rate %"
                  color="var(--color-chart-2)"
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Tool Success Rate Trend</CardTitle>
                <CardDescription>% of tool calls that succeeded</CardDescription>
              </CardHeader>
              <CardContent>
                <QualityTrendChart
                  data={qualityTrend.map((m) => ({
                    ...m,
                    tool_success_rate:
                      m.tool_call_count > 0
                        ? Math.round(
                            (m.tool_success_count / m.tool_call_count) * 100
                          )
                        : 0,
                  }))}
                  dataKey="tool_success_rate"
                  label="Tool Success %"
                  color="var(--color-chart-1)"
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Fallback Rate Trend</CardTitle>
                <CardDescription>% of conversations using fallback</CardDescription>
              </CardHeader>
              <CardContent>
                <QualityTrendChart
                  data={qualityTrend.map((m) => ({
                    ...m,
                    fallback_rate:
                      m.total_conversations > 0
                        ? Math.round(
                            (m.fallback_count / m.total_conversations) * 100
                          )
                        : 0,
                  }))}
                  dataKey="fallback_rate"
                  label="Fallback Rate %"
                  color="var(--color-chart-5)"
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Avg Response Latency Trend</CardTitle>
                <CardDescription>Seconds to first reply</CardDescription>
              </CardHeader>
              <CardContent>
                <QualityTrendChart
                  data={qualityTrend.map((m) => ({
                    ...m,
                    avg_latency_s: m.avg_response_latency_ms
                      ? Math.round(m.avg_response_latency_ms / 1000)
                      : 0,
                  }))}
                  dataKey="avg_latency_s"
                  label="Avg Latency (s)"
                  color="var(--color-chart-4)"
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Recent Conversations Feed with Quality Flags */}
      <div>
        <h2 className="text-lg font-heading font-semibold mb-3 flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Recent Conversations
          <span className="text-sm font-normal text-muted-foreground">
            (live quality scoring)
          </span>
        </h2>
        {conversationSummaries.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-medium text-lg mb-1">No conversations yet</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Live conversation data will appear here once the AI bot starts
                chatting with customers.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Messages</TableHead>
                    <TableHead>Quality Flags</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Latency</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conversationSummaries.map((conv) => (
                    <TableRow key={conv.phone_number} className="transition-colors hover:bg-muted/50 active:bg-muted/80 active:scale-[0.995]">
                      <TableCell>
                        <div className="font-medium">
                          {conv.customer_name || formatPhone(conv.phone_number)}
                        </div>
                        {conv.customer_name && (
                          <div className="text-xs text-muted-foreground">
                            {formatPhone(conv.phone_number)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm">{conv.message_count}</span>
                        <span className="text-xs text-muted-foreground block">
                          {conv.user_message_count}u / {conv.assistant_message_count}a
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[280px]">
                          {conv.quality_flags.length === 0 && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                          {conv.quality_flags.map((flag) => (
                            <Badge
                              key={flag}
                              className={`text-xs ${QUALITY_FLAG_COLORS[flag] || ""}`}
                            >
                              {QUALITY_FLAG_LABELS[flag] || flag}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`text-lg font-bold ${
                            conv.quality_score >= 80
                              ? "text-green-600 dark:text-green-400"
                              : conv.quality_score >= 60
                                ? "text-blue-600 dark:text-blue-400"
                                : conv.quality_score >= 40
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {conv.quality_score}
                        </span>
                      </TableCell>
                      <TableCell>
                        {conv.lead_status && (
                          <Badge className={LEAD_STATUS_COLORS[conv.lead_status] || ""}>
                            {LEAD_STATUS_LABELS[conv.lead_status] || conv.lead_status}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {conv.response_latency_ms !== null
                          ? `${(conv.response_latency_ms / 1000).toFixed(1)}s`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {timeAgo(conv.last_message_at)}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/reports/ai-performance/conversations/${encodeURIComponent(conv.phone_number)}`}
                        >
                          <button className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                            <Eye className="h-3 w-3" />
                            View
                          </button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Period summary footer */}
      {prodStats.periodStart && prodStats.periodEnd && (
        <p className="text-xs text-muted-foreground text-center pb-4">
          Production data covers{" "}
          {new Date(prodStats.periodStart).toLocaleDateString("en-ZA")} —{" "}
          {new Date(prodStats.periodEnd).toLocaleDateString("en-ZA")}
        </p>
      )}
    </div>
  );
}
