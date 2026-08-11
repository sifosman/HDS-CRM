"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

export function RevenueTrendChart({
  data,
}: {
  data: { month: string; revenue: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="month" className="text-xs" />
        <YAxis
          className="text-xs"
          tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          formatter={(v) => [`R${Number(v).toLocaleString()}`, "Revenue"]}
          contentStyle={{
            backgroundColor: "var(--color-popover)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
          }}
        />
        <Line
          type="monotone"
          dataKey="revenue"
          stroke="var(--color-chart-1)"
          strokeWidth={2}
          dot={{ fill: "var(--color-chart-1)", r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function PipelineChart({
  data,
}: {
  data: { stage: string; count: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis type="number" className="text-xs" />
        <YAxis
          type="category"
          dataKey="stage"
          className="text-xs"
          width={80}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--color-popover)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
          }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RevenueBarChart({
  data,
}: {
  data: { month: string; revenue: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="month" className="text-xs" />
        <YAxis
          className="text-xs"
          tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          formatter={(v) => [`R${Number(v).toLocaleString()}`, "Revenue"]}
          contentStyle={{
            backgroundColor: "var(--color-popover)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
          }}
        />
        <Bar dataKey="revenue" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({
  data,
}: {
  data: { name: string; value: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={2}
          dataKey="value"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--color-popover)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
          }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function BranchBarChart({
  data,
}: {
  data: { branch: string; value: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="branch" className="text-xs" angle={-20} textAnchor="end" height={70} />
        <YAxis
          className="text-xs"
          tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          formatter={(v) => [`R${Number(v).toLocaleString()}`, "Value"]}
          contentStyle={{
            backgroundColor: "var(--color-popover)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
          }}
        />
        <Bar dataKey="value" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---- Phase 2: AI Performance Charts ----

export function PassRateTrendChart({
  data,
}: {
  data: { run_id: string; pass_rate: number; total: number; passed: number }[];
}) {
  // Use a short label for the x-axis (date portion of run_id)
  const chartData = data.map((d) => ({
    ...d,
    label: d.run_id.replace("run-", "").slice(0, 10),
  }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="label" className="text-xs" />
        <YAxis
          className="text-xs"
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          formatter={(v, name) => {
            if (name === "pass_rate") return [`${v}%`, "Pass Rate"];
            return [v, name];
          }}
          labelFormatter={(label) => `Run: ${label}`}
          contentStyle={{
            backgroundColor: "var(--color-popover)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
          }}
        />
        <Line
          type="monotone"
          dataKey="pass_rate"
          stroke="var(--color-chart-1)"
          strokeWidth={2}
          dot={{ fill: "var(--color-chart-1)", r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CategoryPassRateChart({
  data,
}: {
  data: { category: string; passRate: number; total: number; passed: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          type="number"
          domain={[0, 100]}
          className="text-xs"
          tickFormatter={(v) => `${v}%`}
        />
        <YAxis
          type="category"
          dataKey="category"
          className="text-xs"
          width={130}
        />
        <Tooltip
          formatter={(v) => [`${v}%`, "Pass Rate"]}
          contentStyle={{
            backgroundColor: "var(--color-popover)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
          }}
        />
        <Bar dataKey="passRate" radius={[0, 4, 4, 0]}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={
                d.passRate >= 90
                  ? "var(--color-chart-2)"
                  : d.passRate >= 70
                    ? "var(--color-chart-4)"
                    : "var(--color-chart-5)"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LatencyDistributionChart({
  data,
}: {
  data: { bucket: string; count: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="bucket" className="text-xs" />
        <YAxis className="text-xs" allowDecimals={false} />
        <Tooltip
          formatter={(v) => [v, "Scenarios"]}
          contentStyle={{
            backgroundColor: "var(--color-popover)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
          }}
        />
        <Bar dataKey="count" fill="var(--color-chart-3)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function QualityTrendChart({
  data,
  dataKey,
  label,
  color,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>[];
  dataKey: string;
  label: string;
  color?: string;
}) {
  const chartData = data.map((d) => ({
    ...d,
    label: new Date(d.metric_date).toLocaleDateString("en-ZA", {
      month: "short",
      day: "numeric",
    }),
  }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="label" className="text-xs" />
        <YAxis className="text-xs" allowDecimals={false} />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--color-popover)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
          }}
        />
        <Line
          type="monotone"
          dataKey={dataKey as string}
          stroke={color || "var(--color-chart-1)"}
          strokeWidth={2}
          dot={{ fill: color || "var(--color-chart-1)", r: 3 }}
          name={label}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
