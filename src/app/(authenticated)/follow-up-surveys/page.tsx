import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { FollowUpSurveysTable } from "@/components/follow-up-surveys-table";
import { getFollowUpSurveys, getFollowUpSurveyStats } from "@/lib/queries";

export default async function FollowUpSurveysPage() {
  const access = await requireRole(["owner", "manager", "sales"]);
  if (access.error) redirect("/dashboard?error=access_denied");

  const [surveys, stats] = await Promise.all([
    getFollowUpSurveys(),
    getFollowUpSurveyStats(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Follow-up Surveys</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Post-purchase feedback on store service, salesperson performance, and bot
          quoting speed — measures online lead conversion to in-store sales
        </p>
      </div>
      <FollowUpSurveysTable surveys={surveys} stats={stats} />
    </div>
  );
}
