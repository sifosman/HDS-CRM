import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { MessageSquare } from "lucide-react";
import { KpiCard } from "@/components/kpi-card";
import { TemplateFormTrigger } from "@/components/template-form";
import { TemplatesTable } from "@/components/templates-table";
import { getWaTemplates, getBroadcastStats } from "@/lib/queries";
import { isMetaConfigured } from "@/lib/meta/client";

// Templates page is dynamic — it reads live data and mutates via server actions.
export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const access = await requireRole(["owner", "manager"]);
  if (access.error) redirect("/dashboard?error=access_denied");
  const [templates, stats] = await Promise.all([
    getWaTemplates(),
    getBroadcastStats(),
  ]);
  const metaConfigured = isMetaConfigured();

  const approved = stats.templatesByStatus.approved || 0;
  const pending = stats.templatesByStatus.pending || 0;
  const rejected = stats.templatesByStatus.rejected || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold">WhatsApp Templates</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create, submit, and manage Meta message templates for broadcasts
          </p>
        </div>
        <TemplateFormTrigger metaConfigured={metaConfigured} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Templates"
          value={String(stats.totalTemplates)}
          icon={MessageSquare}
        />
        <KpiCard
          title="Approved"
          value={String(approved)}
          icon={MessageSquare}
          description="Ready for broadcasts"
        />
        <KpiCard
          title="Pending Review"
          value={String(pending)}
          icon={MessageSquare}
          description="Awaiting Meta approval"
        />
        <KpiCard
          title="Rejected"
          value={String(rejected)}
          icon={MessageSquare}
          description="Needs revision"
        />
      </div>

      <TemplatesTable templates={templates} metaConfigured={metaConfigured} />
    </div>
  );
}
