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
} from "@/lib/queries";
import {
  TEST_CATEGORY_LABELS,
  TEST_CATEGORY_COLORS,
  TEST_RUN_TYPE_LABELS,
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
  const [
    score,
    runSummaries,
    latestRun,
    categoryStats,
    latencyDist,
    recentFailures,
    prodStats,
    qualityMetrics,
  ] = await Promise.all([
    getAiPerformanceScore(),
    getAiTestRunSummaries(15),
    getLatestAiTestRunSummary(),
    getAiTestCategoryStats(5),
    getAiTestLatencyDistribution(),
    getRecentAiTestFailures(15),
    getAiProductionStats(),
    getAiQualityMetrics(30),
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
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            title="Response Rate"
            value={`${prodStats.responseRate}%`}
            icon={MessageSquare}
            description={`${prodStats.noReplyCount} of ${prodStats.uniqueCustomers} customers unanswered`}
          />
          <KpiCard
            title="Unique Customers"
            value={String(prodStats.uniqueCustomers)}
            icon={Target}
            description={`${prodStats.totalMessages} total messages`}
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
        </h2>

        {/* Latest run KPIs */}
        {latestRun ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4">
              <KpiCard
                title="Latest Run Pass Rate"
                value={`${latestRun.pass_rate}%`}
                icon={CheckCircle2}
                description={`${latestRun.passed}/${latestRun.total} passed`}
              />
              <KpiCard
                title="Run Type"
                value={TEST_RUN_TYPE_LABELS[latestRun.run_type] || latestRun.run_type}
                icon={Bot}
                description={`Concurrency: ${latestRun.concurrency ?? "—"}`}
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
                  <CardDescription>Last {runSummaries.length} test runs</CardDescription>
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
                  <CardDescription>Aggregated across last 5 runs</CardDescription>
                </CardHeader>
                <CardContent>
                  <CategoryPassRateChart
                    data={categoryStats.map((s) => ({
                      category: TEST_CATEGORY_LABELS[s.category] || s.category,
                      passRate: s.passRate,
                      total: s.total,
                      passed: s.passed,
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
                  Per-category pass rates and latency (last 5 runs)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
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
                      .sort((a, b) => b.passRate - a.passRate)
                      .map((stat) => (
                        <TableRow key={stat.category}>
                          <TableCell>
                            <Badge
                              className={TEST_CATEGORY_COLORS[stat.category] || ""}
                            >
                              {TEST_CATEGORY_LABELS[stat.category] || stat.category}
                            </Badge>
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
