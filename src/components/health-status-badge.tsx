import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  HEALTH_STATUS_LABELS,
  HEALTH_STATUS_COLORS,
} from "@/lib/constants";
import type { HealthStatus } from "@/lib/types";

const STATUS_DOT_COLORS: Record<HealthStatus, string> = {
  healthy: "bg-green-500",
  degraded: "bg-amber-500",
  down: "bg-red-500",
  unknown: "bg-gray-400",
};

export function HealthStatusBadge({
  status,
  showDot = true,
  className,
}: {
  status: HealthStatus;
  showDot?: boolean;
  className?: string;
}) {
  return (
    <Badge
      variant="secondary"
      className={cn(HEALTH_STATUS_COLORS[status], className)}
    >
      {showDot && (
        <span
          className={cn(
            "mr-1.5 inline-block h-2 w-2 rounded-full",
            STATUS_DOT_COLORS[status]
          )}
        />
      )}
      {HEALTH_STATUS_LABELS[status] || status}
    </Badge>
  );
}
