"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Phone } from "lucide-react";
import {
  INTELLIGENCE_CATEGORY_LABELS,
  INTELLIGENCE_CATEGORY_COLORS,
  INTELLIGENCE_SEVERITY_LABELS,
  INTELLIGENCE_SEVERITY_COLORS,
  formatDateTime,
} from "@/lib/constants";
import type { IntelligenceReport } from "@/lib/types";

function maskPhone(phone: string) {
  if (phone.length <= 4) return phone;
  return "***" + phone.slice(-4);
}

export function IntelligenceCard({
  report,
}: {
  report: IntelligenceReport;
}) {
  const [expanded, setExpanded] = useState(false);

  const details = report.details as Record<string, unknown>;
  const detailEntries = Object.entries(details).filter(
    ([key]) => key !== "source_phones"
  );

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            className={INTELLIGENCE_CATEGORY_COLORS[report.category]}
            variant="secondary"
          >
            {INTELLIGENCE_CATEGORY_LABELS[report.category] || report.category}
          </Badge>
          <Badge
            className={INTELLIGENCE_SEVERITY_COLORS[report.severity]}
            variant="secondary"
          >
            {INTELLIGENCE_SEVERITY_LABELS[report.severity] || report.severity}
          </Badge>
          {report.conversation_count > 0 && (
            <span className="text-xs text-muted-foreground">
              {report.conversation_count} conversation
              {report.conversation_count !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {report.report_date}
        </span>
      </div>

      <p className="text-sm">{report.insight_summary}</p>

      {detailEntries.length > 0 && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            {detailEntries.length} detail
            {detailEntries.length !== 1 ? "s" : ""}
          </button>

          {expanded && (
            <div className="mt-2 space-y-1 rounded-md bg-muted/50 p-3">
              {detailEntries.map(([key, value]) => (
                <div key={key} className="text-xs">
                  <span className="font-medium capitalize">
                    {key.replace(/_/g, " ")}:
                  </span>{" "}
                  <span className="text-muted-foreground">
                    {typeof value === "object"
                      ? JSON.stringify(value)
                      : String(value)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {report.source_phones && report.source_phones.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <Phone className="h-3 w-3 text-muted-foreground" />
          {report.source_phones.map((phone, i) => (
            <span
              key={i}
              className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded"
            >
              {maskPhone(phone)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
