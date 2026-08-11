import { Megaphone, Send, CheckCircle2, Users } from "lucide-react";
import { KpiCard } from "@/components/kpi-card";
import { BroadcastFormTrigger } from "@/components/broadcast-form";
import { BroadcastsTable } from "@/components/broadcasts-table";
import {
  getBroadcastCampaigns,
  getApprovedWaTemplates,
  getBroadcastSegments,
  getBroadcastStats,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function BroadcastsPage() {
  const [campaigns, templates, segments, stats] = await Promise.all([
    getBroadcastCampaigns(),
    getApprovedWaTemplates(),
    getBroadcastSegments(),
    getBroadcastStats(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold">Broadcast Campaigns</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Send WhatsApp template messages to customer segments
          </p>
        </div>
        <BroadcastFormTrigger templates={templates} segments={segments} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Campaigns"
          value={String(stats.totalCampaigns)}
          icon={Megaphone}
        />
        <KpiCard
          title="Messages Sent"
          value={String(stats.totals.sent_count)}
          icon={Send}
        />
        <KpiCard
          title="Delivered"
          value={String(stats.totals.delivered_count)}
          icon={CheckCircle2}
          description={`${stats.totals.read_count} read`}
        />
        <KpiCard
          title="Total Recipients"
          value={String(stats.totals.total_recipients)}
          icon={Users}
        />
      </div>

      <BroadcastsTable campaigns={campaigns} />
    </div>
  );
}
