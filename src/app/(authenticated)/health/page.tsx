import { Activity, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { HealthCard } from "@/components/health-card";
import { HealthStatusBadge } from "@/components/health-status-badge";
import { KpiCard } from "@/components/kpi-card";
import {
  getHealthSummary,
  getRecentHealthFailures,
  getOverallSystemStatus,
} from "@/lib/queries";
import {
  HEALTH_COMPONENT_LABELS,
  formatDateTime,
  timeAgo,
} from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function HealthPage() {
  const [summaries, failures] = await Promise.all([
    getHealthSummary(),
    getRecentHealthFailures(25),
  ]);

  const overallStatus = getOverallSystemStatus(summaries);
  const totalComponents = summaries.length;
  const healthyCount = summaries.filter((s) => s.status === "healthy").length;
  const degradedCount = summaries.filter((s) => s.status === "degraded").length;
  const downCount = summaries.filter((s) => s.status === "down").length;
  const unknownCount = summaries.filter((s) => s.status === "unknown").length;

  // Average uptime across all components that have checks
  const componentsWithChecks = summaries.filter(
    (s) => s.total_checks_30d > 0
  );
  const avgUptime =
    componentsWithChecks.length > 0
      ? Math.round(
          componentsWithChecks.reduce((sum, s) => sum + s.uptime_30d, 0) /
            componentsWithChecks.length
        )
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold">System Health</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Live status of all system components — checked every 5 minutes
          </p>
        </div>
        <HealthStatusBadge status={overallStatus} />
      </div>

      {/* Summary KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Components Healthy"
          value={`${healthyCount}/${totalComponents}`}
          icon={CheckCircle2}
          description={
            downCount > 0
              ? `${downCount} down, ${degradedCount} degraded`
              : degradedCount > 0
                ? `${degradedCount} degraded`
                : "All systems operational"
          }
        />
        <KpiCard
          title="Avg Uptime (30d)"
          value={`${avgUptime}%`}
          icon={Activity}
          description={`Across ${componentsWithChecks.length} components`}
        />
        <KpiCard
          title="Active Incidents"
          value={String(downCount + degradedCount)}
          icon={AlertCircle}
          description={
            downCount > 0
              ? `${downCount} down, ${degradedCount} degraded`
              : degradedCount > 0
                ? `${degradedCount} degraded`
                : "No active incidents"
          }
        />
        <KpiCard
          title="Recent Failures (30d)"
          value={String(failures.length)}
          icon={XCircle}
          description="Degraded or down events"
        />
      </div>

      {/* Component cards */}
      <div>
        <h2 className="text-lg font-heading font-semibold mb-3">
          Component Status
        </h2>
        {summaries.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Activity className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No health check data yet. The n8n Health Monitor workflow needs
                to be deployed and running.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                See{" "}
                <code className="bg-muted px-1.5 py-0.5 rounded">
                  Chatbot Tests/docs/phase3-health-monitor.md
                </code>{" "}
                for setup instructions.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {summaries.map((summary) => (
              <HealthCard key={summary.component} summary={summary} />
            ))}
          </div>
        )}
      </div>

      {/* Recent failure log */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Failures</CardTitle>
          <p className="text-xs text-muted-foreground">
            Last 25 degraded or down events
          </p>
        </CardHeader>
        <CardContent>
          {failures.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No failures in the recent period — all checks passing.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Component</TableHead>
                  <TableHead>Check</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead className="text-right">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {failures.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">
                      {HEALTH_COMPONENT_LABELS[f.component] || f.component}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {f.check_name}
                    </TableCell>
                    <TableCell>
                      <HealthStatusBadge status={f.status} showDot={false} />
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate text-muted-foreground">
                      {f.message || "—"}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground whitespace-nowrap">
                      <span title={formatDateTime(f.checked_at)}>
                        {timeAgo(f.checked_at)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Unknown components notice */}
      {unknownCount > 0 && (
        <Card className="border-amber-200 dark:border-amber-900">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {unknownCount} component{unknownCount !== 1 ? "s" : ""} with
                  no health data
                </p>
                <p className="text-xs text-muted-foreground">
                  The Health Monitor workflow may not be running or has not
                  checked all components yet. Verify the n8n workflow is active
                  and all credentials are configured.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
