import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConversationLog } from "@/components/conversation-log";
import {
  getConversationsByPhone,
  getRecentConversationSummaries,
} from "@/lib/queries";
import {
  QUALITY_FLAG_LABELS,
  QUALITY_FLAG_COLORS,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_COLORS,
  CUSTOMER_TYPE_LABELS,
  CUSTOMER_TYPE_COLORS,
  formatPhone,
  formatCurrency,
  formatDateTime,
  timeAgo,
} from "@/lib/constants";

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ phone: string }>;
}) {
  const { phone } = await params;

  const access = await requireRole(["owner", "manager"]);
  if (access.error) redirect("/dashboard?error=access_denied");
  const decodedPhone = decodeURIComponent(phone);

  const [conversations, summaries] = await Promise.all([
    getConversationsByPhone(decodedPhone, 200),
    getRecentConversationSummaries(100),
  ]);

  if (conversations.length === 0) {
    notFound();
  }

  // Find this conversation's summary
  const summary = summaries.find((s) => s.phone_number === decodedPhone);

  const userMsgs = conversations.filter((c) => c.role === "user");
  const assistantMsgs = conversations.filter((c) => c.role === "assistant");
  const toolMsgs = conversations.filter((c) => c.role === "tool");
  const firstMsg = conversations[0];
  const lastMsg = conversations[conversations.length - 1];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/reports/ai-performance">
          <Button variant="ghost" size="sm" className="mb-2">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to AI Performance
          </Button>
        </Link>
        <h1 className="text-2xl font-heading font-bold">
          {summary?.customer_name || formatPhone(decodedPhone)}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {formatPhone(decodedPhone)}
          {summary?.customer_type && (
            <>
              {" · "}
              <Badge
                className={`ml-1 ${CUSTOMER_TYPE_COLORS[summary.customer_type] || ""}`}
              >
                {CUSTOMER_TYPE_LABELS[summary.customer_type] || summary.customer_type}
              </Badge>
            </>
          )}
        </p>
      </div>

      {/* Quality Summary */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Quality Score</CardDescription>
              <CardTitle
                className={`text-3xl ${
                  summary.quality_score >= 80
                    ? "text-green-600 dark:text-green-400"
                    : summary.quality_score >= 60
                      ? "text-blue-600 dark:text-blue-400"
                      : summary.quality_score >= 40
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-red-600 dark:text-red-400"
                }`}
              >
                {summary.quality_score}
                <span className="text-lg text-muted-foreground">/100</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={summary.quality_score} className="h-2" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Messages</CardDescription>
              <CardTitle className="text-3xl">{summary.message_count}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {summary.user_message_count} from customer ·{" "}
                {summary.assistant_message_count} from AI
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Response Latency</CardDescription>
              <CardTitle className="text-3xl">
                {summary.response_latency_ms !== null
                  ? `${(summary.response_latency_ms / 1000).toFixed(1)}s`
                  : "—"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Time to first reply</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Lead Status</CardDescription>
              <CardTitle className="text-xl">
                {summary.lead_status ? (
                  <Badge className={LEAD_STATUS_COLORS[summary.lead_status] || ""}>
                    {LEAD_STATUS_LABELS[summary.lead_status] || summary.lead_status}
                  </Badge>
                ) : (
                  "—"
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {summary.quote_total !== null && (
                <p className="text-xs text-muted-foreground">
                  Quote: {formatCurrency(summary.quote_total)}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quality Flags */}
      {summary && summary.quality_flags.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Quality Flags Detected</CardTitle>
            <CardDescription>
              Automated quality signals from this conversation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {summary.quality_flags.map((flag) => (
                <Badge
                  key={flag}
                  className={QUALITY_FLAG_COLORS[flag] || ""}
                >
                  {QUALITY_FLAG_LABELS[flag] || flag}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conversation Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Conversation Transcript</CardTitle>
          <CardDescription>
            {conversations.length} messages ·{" "}
            {formatDateTime(firstMsg.created_at)} —{" "}
            {formatDateTime(lastMsg.created_at)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConversationLog conversations={conversations} />
        </CardContent>
      </Card>

      {/* Tool Calls Detail */}
      {toolMsgs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Tool Calls ({toolMsgs.length})</CardTitle>
            <CardDescription>
              Tool invocations during this conversation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Tool / Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {toolMsgs.map((msg) => (
                  <TableRow key={msg.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(msg.created_at)}
                    </TableCell>
                    <TableCell className="text-sm">
                      <pre className="text-xs whitespace-pre-wrap break-words max-w-2xl">
                        {msg.message_text?.slice(0, 300) || "—"}
                      </pre>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
