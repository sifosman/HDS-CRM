import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DonutChart, BranchBarChart } from "@/components/charts";
import { KpiCard } from "@/components/kpi-card";
import { getCustomers, getAllQuotes, getBranches } from "@/lib/queries";
import {
  formatCurrency,
  CUSTOMER_TYPE_LABELS,
} from "@/lib/constants";
import { FileText, DollarSign, Users, TrendingUp } from "lucide-react";

export default async function ReportsPage() {
  const [customers, quotes, branches] = await Promise.all([
    getCustomers(),
    getAllQuotes(),
    getBranches(),
  ]);

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const weekQuotes = quotes.filter((q) => {
    const qd = new Date(q.created_at);
    return qd >= weekStart && qd <= weekEnd;
  });

  const totalQuoteValue = weekQuotes.reduce(
    (sum, q) => sum + Number(q.total || 0),
    0
  );
  const avgQuoteSize =
    weekQuotes.length > 0 ? totalQuoteValue / weekQuotes.length : 0;

  const closedLeads = customers.filter(
    (c) => c.lead_status === "closed"
  ).length;
  const conversionRate =
    customers.length > 0
      ? Math.round((closedLeads / customers.length) * 100)
      : 0;

  const newCustomers = customers.filter(
    (c) => c.first_interaction_at && new Date(c.first_interaction_at) >= weekStart
  ).length;
  const returningCustomers = customers.length - newCustomers;

  // Customer type distribution
  const typeDistribution = Object.entries(CUSTOMER_TYPE_LABELS).map(
    ([key, label]) => ({
      name: label,
      value: customers.filter((c) => c.customer_type === key).length,
    })
  );

  // Sales by branch
  const branchSales = branches
    .map((b) => ({
      branch: b.trading_as?.split(" ")[0] || `#${b.id}`,
      value: quotes
        .filter(
          (q) =>
            q.branch_trading_as === b.trading_as ||
            q.trading_as === b.trading_as
        )
        .reduce((sum, q) => sum + Number(q.total || 0), 0),
    }))
    .filter((b) => b.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 15);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Weekly Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Week of {weekStart.toLocaleDateString("en-ZA")} —{" "}
          {weekEnd.toLocaleDateString("en-ZA")}
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Quotes Generated"
          value={String(weekQuotes.length)}
          icon={FileText}
          description="This week"
        />
        <KpiCard
          title="Total Quote Value"
          value={formatCurrency(totalQuoteValue)}
          icon={DollarSign}
          description="This week"
        />
        <KpiCard
          title="Conversion Rate"
          value={`${conversionRate}%`}
          icon={TrendingUp}
          description={`${closedLeads} closed / ${customers.length} total`}
        />
        <KpiCard
          title="New Customers"
          value={String(newCustomers)}
          icon={Users}
          description={`${returningCustomers} returning`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <KpiCard
          title="Average Quote Size"
          value={formatCurrency(avgQuoteSize)}
          icon={DollarSign}
        />
        <KpiCard
          title="Total Customers"
          value={String(customers.length)}
          icon={Users}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sales by Branch</CardTitle>
          </CardHeader>
          <CardContent>
            {branchSales.length > 0 ? (
              <BranchBarChart data={branchSales} />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No branch sales data available
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lead Source Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart data={typeDistribution} />
          </CardContent>
        </Card>
      </div>

      {/* Top Products */}
      <Card>
        <CardHeader>
          <CardTitle>Top Quoted Materials</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Quote Count</TableHead>
                <TableHead className="text-right">Total Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(() => {
                const productMap: Record<string, { count: number; value: number }> = {};
                quotes.forEach((q) => {
                  const name = q.customer_name || "Unknown";
                  if (!productMap[name]) productMap[name] = { count: 0, value: 0 };
                  productMap[name].count++;
                  productMap[name].value += Number(q.total || 0);
                });
                const topProducts = Object.entries(productMap)
                  .sort((a, b) => b[1].value - a[1].value)
                  .slice(0, 10);

                if (topProducts.length === 0) {
                  return (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        No data available
                      </TableCell>
                    </TableRow>
                  );
                }
                return topProducts.map(([name, stats]) => (
                  <TableRow key={name}>
                    <TableCell className="font-medium">{name}</TableCell>
                    <TableCell className="text-right">{stats.count}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(stats.value)}
                    </TableCell>
                  </TableRow>
                ));
              })()}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
