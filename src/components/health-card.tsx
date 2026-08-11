import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { HealthStatusBadge } from "@/components/health-status-badge";
import {
  HEALTH_COMPONENT_LABELS,
  HEALTH_COMPONENT_DESCRIPTIONS,
  HEALTH_STATUS_BORDER,
  timeAgo,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { HealthComponentSummary } from "@/lib/types";

function renderDetailValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function HealthCard({ summary }: { summary: HealthComponentSummary }) {
  const label =
    HEALTH_COMPONENT_LABELS[summary.component] || summary.component;
  const description =
    HEALTH_COMPONENT_DESCRIPTIONS[summary.component] || "";
  const borderClass = HEALTH_STATUS_BORDER[summary.status] || "border-l-gray-400";

  const detailEntries = summary.details
    ? Object.entries(summary.details).slice(0, 6)
    : [];

  return (
    <Card className={cn("border-l-4", borderClass)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base font-heading truncate">
              {label}
            </CardTitle>
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {description}
              </p>
            )}
          </div>
          <HealthStatusBadge status={summary.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Last check info */}
        <div className="space-y-1">
          {summary.message && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {summary.message}
            </p>
          )}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Last check:{" "}
              {summary.last_check_at
                ? timeAgo(summary.last_check_at)
                : "never"}
            </span>
            {summary.latency_ms !== null && (
              <span>{summary.latency_ms}ms</span>
            )}
          </div>
        </div>

        {/* Uptime bar */}
        {summary.total_checks_30d > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">30-day uptime</span>
              <span className="font-medium">{summary.uptime_30d}%</span>
            </div>
            <Progress
              value={summary.uptime_30d}
              className={cn(
                "h-2",
                summary.uptime_30d >= 99
                  ? "[&>div]:bg-green-500"
                  : summary.uptime_30d >= 90
                    ? "[&>div]:bg-amber-500"
                    : "[&>div]:bg-red-500"
              )}
            />
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{summary.total_checks_30d} checks</span>
              <span className="text-green-600 dark:text-green-400">
                {summary.healthy_checks_30d} healthy
              </span>
              {summary.degraded_checks_30d > 0 && (
                <span className="text-amber-600 dark:text-amber-400">
                  {summary.degraded_checks_30d} degraded
                </span>
              )}
              {summary.down_checks_30d > 0 && (
                <span className="text-red-600 dark:text-red-400">
                  {summary.down_checks_30d} down
                </span>
              )}
            </div>
          </div>
        )}

        {/* Component-specific details (Meta quality rating, token expiry, etc.) */}
        {detailEntries.length > 0 && (
          <div className="rounded-md bg-muted/50 p-2.5 space-y-1">
            {detailEntries.map(([key, value]) => (
              <div key={key} className="flex items-center justify-between text-xs gap-2">
                <span className="font-medium capitalize text-muted-foreground shrink-0">
                  {key.replace(/_/g, " ")}
                </span>
                <span className="text-right truncate">
                  {renderDetailValue(value)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
