"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Send,
  XCircle,
  Loader2,
  Eye,
  XCircle as XIcon,
} from "lucide-react";
import type { BroadcastCampaign, BroadcastRecipient } from "@/lib/types";
import {
  BROADCAST_CAMPAIGN_STATUS_LABELS,
  BROADCAST_CAMPAIGN_STATUS_COLORS,
  BROADCAST_RECIPIENT_STATUS_COLORS,
  BROADCAST_RECIPIENT_STATUS_LABELS,
  formatDateTime,
  formatPhone,
} from "@/lib/constants";
import {
  sendBroadcastCampaign,
  cancelBroadcastCampaign,
} from "@/app/(authenticated)/broadcasts/actions";

type CampaignWithNames = BroadcastCampaign & {
  template_name: string | null;
  segment_name: string | null;
};

type BroadcastsTableProps = {
  campaigns: CampaignWithNames[];
};

export function BroadcastsTable({ campaigns }: BroadcastsTableProps) {
  const [pending, startTransition] = useTransition();
  const [sendId, setSendId] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  function flash(ok: boolean, msg: string) {
    setFeedback({ ok, msg });
    setTimeout(() => setFeedback(null), 4000);
  }

  function handleSend() {
    if (!sendId) return;
    startTransition(async () => {
      const res = await sendBroadcastCampaign(sendId);
      setSendId(null);
      flash(res.ok, res.ok ? `Sent ${res.count} messages` : res.error);
    });
  }

  function handleCancel() {
    if (!cancelId) return;
    startTransition(async () => {
      const res = await cancelBroadcastCampaign(cancelId);
      setCancelId(null);
      flash(res.ok, res.ok ? "Campaign cancelled" : res.error);
    });
  }

  return (
    <div className="space-y-4">
      {feedback && (
        <div
          className={`rounded-md p-3 text-sm ${
            feedback.ok
              ? "bg-success/10 text-success"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {feedback.msg}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Segment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Recipients</TableHead>
                <TableHead className="text-right">Sent</TableHead>
                <TableHead className="text-right">Delivered</TableHead>
                <TableHead className="text-right">Read</TableHead>
                <TableHead className="text-right">Failed</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                    No campaigns yet. Click &quot;New Broadcast&quot; to create one.
                  </TableCell>
                </TableRow>
              )}
              {campaigns.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <Link href={`/broadcasts/${c.id}`} className="hover:underline">
                      {c.name}
                    </Link>
                    {c.test_mode && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        TEST
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm font-mono">
                    {c.template_name || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.segment_name || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={BROADCAST_CAMPAIGN_STATUS_COLORS[c.status]}
                      variant="secondary"
                    >
                      {BROADCAST_CAMPAIGN_STATUS_LABELS[c.status] || c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{c.total_recipients}</TableCell>
                  <TableCell className="text-right">{c.sent_count}</TableCell>
                  <TableCell className="text-right">{c.delivered_count}</TableCell>
                  <TableCell className="text-right">{c.read_count}</TableCell>
                  <TableCell className="text-right text-destructive">
                    {c.failed_count}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(c.scheduled_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Link href={`/broadcasts/${c.id}`}>
                        <Button variant="ghost" size="icon-sm" title="Details">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      {(c.status === "draft" || c.status === "scheduled") && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setSendId(c.id)}
                          disabled={pending}
                          title="Send now"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      )}
                      {(c.status === "draft" || c.status === "scheduled") && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setCancelId(c.id)}
                          disabled={pending}
                          title="Cancel"
                        >
                          <XCircle className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Send confirmation */}
      <Dialog open={!!sendId} onOpenChange={(o) => !o && setSendId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Send broadcast now?</DialogTitle>
            <DialogDescription>
              This will send WhatsApp template messages to all pending recipients.
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendId(null)}>
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation */}
      <Dialog open={!!cancelId} onOpenChange={(o) => !o && setCancelId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancel campaign?</DialogTitle>
            <DialogDescription>
              The campaign will be marked as cancelled. No messages will be sent.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelId(null)}>
              Keep
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <XIcon className="h-4 w-4" />}
              Cancel Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function BroadcastRecipientsTable({
  recipients,
}: {
  recipients: BroadcastRecipient[];
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Phone</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>WA Message ID</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead>Delivered</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recipients.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No recipients
                </TableCell>
              </TableRow>
            )}
            {recipients.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-sm">
                  {formatPhone(r.phone)}
                </TableCell>
                <TableCell className="text-sm">{r.customer_name || "—"}</TableCell>
                <TableCell>
                  <Badge
                    className={BROADCAST_RECIPIENT_STATUS_COLORS[r.status]}
                    variant="secondary"
                  >
                    {BROADCAST_RECIPIENT_STATUS_LABELS[r.status] || r.status}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {r.wa_message_id || "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDateTime(r.sent_at)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDateTime(r.delivered_at)}
                </TableCell>
                <TableCell className="text-xs text-destructive">
                  {r.error_message || "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
