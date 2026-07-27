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
import { RevenueBarChart } from "@/components/charts";
import { getAllQuotes, getInvoices } from "@/lib/queries";
import { formatCurrency, formatDate } from "@/lib/constants";
import { AlertCircle } from "lucide-react";

export default async function PaymentsPage() {
  const [quotes, invoices] = await Promise.all([
    getAllQuotes(),
    getInvoices(),
  ]);

  // Monthly revenue from paid invoices
  const now = new Date();
  const monthlyRevenue: { month: string; revenue: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    const monthName = d.toLocaleString("en-ZA", { month: "short" });
    const revenue = invoices
      .filter((inv) => {
        const id = new Date(inv.created_at);
        return id >= d && id <= monthEnd;
      })
      .reduce((sum, inv) => sum + Number(inv.total || 0), 0);
    monthlyRevenue.push({ month: monthName, revenue });
  }

  const outstanding = invoices.filter(
    (inv) => inv.status === "pending" || inv.status === "partial"
  );
  const totalOutstanding = outstanding.reduce(
    (sum, inv) => sum + Number(inv.total || 0),
    0
  );

  const totalRevenue = invoices
    .filter((inv) => inv.status === "paid")
    .reduce((sum, inv) => sum + Number(inv.total || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Payments</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Payment tracking and revenue overview
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Revenue (Paid)</p>
            <p className="text-xl font-bold font-heading text-success">
              {formatCurrency(totalRevenue)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Outstanding</p>
            <p className="text-xl font-bold font-heading text-warning">
              {formatCurrency(totalOutstanding)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Invoices</p>
            <p className="text-xl font-bold font-heading">{invoices.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Revenue (Paid Invoices)</CardTitle>
        </CardHeader>
        <CardContent>
          <RevenueBarChart data={monthlyRevenue} />
        </CardContent>
      </Card>

      {/* Outstanding Payments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-warning" />
            Outstanding Payments ({outstanding.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {outstanding.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No outstanding payments
                  </TableCell>
                </TableRow>
              )}
              {outstanding.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-xs">
                    {inv.invoice_number}
                  </TableCell>
                  <TableCell className="font-medium">
                    {inv.customer_name || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(Number(inv.total))}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(inv.created_at)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                      variant="secondary"
                    >
                      {inv.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
