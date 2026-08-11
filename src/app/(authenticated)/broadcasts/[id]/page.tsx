import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Send, Users, CheckCircle2, XCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/kpi-card";
import { BroadcastRecipientsTable, SendCampaignButton } from "@/components/broadcast-detail-actions";
import {
  getBroadcastCampaign,
  getBroadcastRecipients,
} from "@/lib/queries";
import {
  BROADCAST_CAMPAIGN_STATUS_LABELS,
  BROADCAST_CAMPAIGN_STATUS_COLORS,
  formatDateTime,
} from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function BroadcastDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await getBroadcastCampaign(id);
  if (!campaign) notFound();

  const recipients = await getBroadcastRecipients(id, 500);

  const canSend = campaign.status === "draft" || campaign.status === "scheduled";

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/broadcasts"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Broadcasts
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold">{campaign.name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge
                className={BROADCAST_CAMPAIGN_STATUS_COLORS[campaign.status]}
                variant="secondary"
              >
                {BROADCAST_CAMPAIGN_STATUS_LABELS[campaign.status] || campaign.status}
              </Badge>
              {campaign.test_mode && (
                <Badge variant="outline">TEST MODE</Badge>
              )}
              <span className="text-sm text-muted-foreground">
                Template: <span className="font-mono">{campaign.template_name || "—"}</span>
              </span>
              <span className="text-sm text-muted-foreground">
                Segment: {campaign.segment_name || "—"}
              </span>
            </div>
          </div>
          {canSend && <SendCampaignButton campaignId={campaign.id} />}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Recipients"
          value={String(campaign.total_recipients)}
          icon={Users}
        />
        <KpiCard
          title="Sent"
          value={String(campaign.sent_count)}
          icon={Send}
        />
        <KpiCard
          title="Delivered"
          value={String(campaign.delivered_count)}
          icon={CheckCircle2}
          description={`${campaign.read_count} read`}
        />
        <KpiCard
          title="Failed"
          value={String(campaign.failed_count)}
          icon={XCircle}
          description={`${campaign.replied_count} replied`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Campaign Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd>{formatDateTime(campaign.created_at)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Scheduled</dt>
              <dd>{formatDateTime(campaign.scheduled_at)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Started</dt>
              <dd>{formatDateTime(campaign.started_at)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Completed</dt>
              <dd>{formatDateTime(campaign.completed_at)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-heading font-semibold mb-3">
          Recipients ({recipients.length})
        </h2>
        <BroadcastRecipientsTable recipients={recipients} />
      </div>
    </div>
  );
}
