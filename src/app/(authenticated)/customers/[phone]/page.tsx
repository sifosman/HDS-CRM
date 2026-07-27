import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConversationLog } from "@/components/conversation-log";
import { SalesNotesEditor } from "@/components/sales-notes-editor";
import {
  getCustomerByPhone,
  getConversationsByPhone,
  getQuotesByPhone,
} from "@/lib/queries";
import {
  LEAD_STATUS_LABELS,
  LEAD_STATUS_COLORS,
  CUSTOMER_TYPE_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
  PIPELINE_STAGES,
  formatCurrency,
  formatDate,
  formatPhone,
  formatDateTime,
} from "@/lib/constants";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ phone: string }>;
}) {
  const { phone } = await params;
  const decodedPhone = decodeURIComponent(phone);
  const customer = await getCustomerByPhone(decodedPhone);

  if (!customer) {
    notFound();
  }

  const [conversations, quotes] = await Promise.all([
    getConversationsByPhone(decodedPhone),
    getQuotesByPhone(decodedPhone),
  ]);

  const currentStageIndex = PIPELINE_STAGES.indexOf(
    (customer.lead_status as (typeof PIPELINE_STAGES)[number]) || "new"
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/customers">
          <Button variant="ghost" size="sm" className="mb-2">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Customers
          </Button>
        </Link>
        <h1 className="text-2xl font-heading font-bold">
          {customer.name || "Unknown Customer"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {formatPhone(customer.phone_number)}
        </p>
      </div>

      {/* Profile Header */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Customer Type</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">
              {CUSTOMER_TYPE_LABELS[customer.customer_type || "unknown"] ||
                "Unknown"}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">First Interaction</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{formatDate(customer.first_interaction_at)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Preferred Branch</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{customer.preferred_branch || "—"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Sales Pipeline */}
      <Card>
        <CardHeader>
          <CardTitle>Sales Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {PIPELINE_STAGES.map((stage, i) => (
              <div key={stage} className="flex items-center gap-2">
                <div
                  className={`flex flex-col items-center gap-1 min-w-[80px] ${
                    i <= currentStageIndex ? "" : "opacity-40"
                  }`}
                >
                  <div
                    className={`h-2 w-full rounded-full ${
                      i <= currentStageIndex
                        ? "bg-primary"
                        : "bg-muted"
                    }`}
                  />
                  <span className="text-xs whitespace-nowrap">
                    {LEAD_STATUS_LABELS[stage]}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <Badge
              className={LEAD_STATUS_COLORS[customer.lead_status || "new"]}
              variant="secondary"
            >
              Current: {LEAD_STATUS_LABELS[customer.lead_status || "new"]}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Quote History */}
        <Card>
          <CardHeader>
            <CardTitle>Quote History ({quotes.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quote #</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No quotes yet
                    </TableCell>
                  </TableRow>
                )}
                {quotes.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono text-xs">
                      {q.quote_number || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(Number(q.total))}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(q.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{q.status || "sent"}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Close Attempt History */}
        <Card>
          <CardHeader>
            <CardTitle>Sales Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Close Attempts:</span>
                <span className="font-medium ml-2">
                  {customer.close_attempt_count}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Last Close Type:</span>
                <span className="font-medium ml-2">
                  {customer.last_close_type || "—"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Customer Response:</span>
                <span className="font-medium ml-2">
                  {customer.customer_response || "—"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Sale Outcome:</span>
                <span className="font-medium ml-2">
                  {customer.sale_outcome || "pending"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Follow-up Needed:</span>
                <span className="font-medium ml-2">
                  {customer.follow_up_needed ? "Yes" : "No"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Follow-up Date:</span>
                <span className="font-medium ml-2">
                  {formatDate(customer.follow_up_date)}
                </span>
              </div>
            </div>

            {/* Objections */}
            {customer.objections && customer.objections.length > 0 && (
              <div className="pt-3 border-t">
                <p className="text-sm font-medium mb-2">
                  Objections ({customer.objection_count})
                </p>
                <div className="flex flex-wrap gap-2">
                  {customer.objections.map((obj, i) => (
                    <Badge
                      key={i}
                      className="bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                      variant="secondary"
                    >
                      {obj}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* WhatsApp Conversation */}
      <Card>
        <CardHeader>
          <CardTitle>WhatsApp Conversation ({conversations.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ConversationLog conversations={conversations} />
        </CardContent>
      </Card>

      {/* Sales Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Sales Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <SalesNotesEditor
            phone={customer.phone_number}
            initialNotes={customer.sales_notes}
          />
        </CardContent>
      </Card>
    </div>
  );
}
