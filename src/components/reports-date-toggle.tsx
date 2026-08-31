"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CalendarRange } from "lucide-react";

type RangeKey = "weekly" | "monthly" | "yearly" | "all" | "custom";

const RANGE_LABELS: Record<RangeKey, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
  all: "All Time",
  custom: "Custom",
};

function todayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function startOfMonthISO(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function startOfYearISO(): string {
  const d = new Date();
  return new Date(d.getFullYear(), 0, 1).toISOString().slice(0, 10);
}

function startOfWeekISO(): string {
  const now = new Date();
  const mondayOffset = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - mondayOffset);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().slice(0, 10);
}

export function ReportsDateToggle() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const rangeParam = (searchParams.get("range") as RangeKey | null) || "monthly";
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  // Local state for the custom date pickers so the user can type before applying
  const [customFrom, setCustomFrom] = useState(
    fromParam || startOfWeekISO()
  );
  const [customTo, setCustomTo] = useState(toParam || todayISO());

  const applyRange = useCallback(
    (range: RangeKey, from?: string, to?: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("range", range);

      if (range === "custom") {
        const f = from || customFrom;
        const t = to || customTo;
        if (f) params.set("from", f);
        else params.delete("from");
        if (t) params.set("to", t);
        else params.delete("to");
      } else {
        params.delete("from");
        params.delete("to");
      }

      router.push(`/reports?${params.toString()}`);
    },
    [router, searchParams, customFrom, customTo]
  );

  const onTabChange = (value: string | number) => {
    const key = String(value) as RangeKey;
    if (key === "custom") {
      // Pre-fill sensible defaults when switching to custom for the first time
      applyRange("custom", customFrom, customTo);
    } else {
      applyRange(key);
    }
  };

  const applyCustom = () => {
    applyRange("custom", customFrom, customTo);
  };

  // Quick preset buttons shown only on the custom tab
  const presets: { label: string; from: string; to: string }[] = [
    { label: "This week", from: startOfWeekISO(), to: todayISO() },
    { label: "This month", from: startOfMonthISO(), to: todayISO() },
    { label: "This year", from: startOfYearISO(), to: todayISO() },
    {
      label: "Last 30 days",
      from: new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10),
      to: todayISO(),
    },
    {
      label: "Last 90 days",
      from: new Date(Date.now() - 89 * 86400000).toISOString().slice(0, 10),
      to: todayISO(),
    },
    {
      label: "All time",
      from: "2020-01-01",
      to: todayISO(),
    },
  ];

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Tabs value={rangeParam} onValueChange={onTabChange}>
        <TabsList>
          {(Object.keys(RANGE_LABELS) as RangeKey[]).map((key) => (
            <TabsTrigger key={key} value={key}>
              {RANGE_LABELS[key]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {rangeParam === "custom" && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-2">
          <div className="flex items-center gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">From</label>
              <Input
                type="date"
                value={customFrom}
                max={customTo}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-[150px]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">To</label>
              <Input
                type="date"
                value={customTo}
                min={customFrom}
                max={todayISO()}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-[150px]"
              />
            </div>
            <Button size="sm" onClick={applyCustom} className="h-8">
              <CalendarRange className="size-4" />
              Apply
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {presets.map((p) => (
              <Button
                key={p.label}
                size="xs"
                variant="outline"
                onClick={() => {
                  setCustomFrom(p.from);
                  setCustomTo(p.to);
                  applyRange("custom", p.from, p.to);
                }}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
