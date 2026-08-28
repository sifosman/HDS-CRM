import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import {
  getAdvisorSessions,
  getAdvisorChangeRequests,
  getAdvisorOwnerNames,
} from "@/app/(authenticated)/ai-training/actions";
import { TrainingWorkspace } from "@/components/ai-training/training-workspace";

export default async function AiTrainingPage() {
  const access = await requireRole(["owner", "manager"]);
  if (access.error) redirect("/dashboard?error=access_denied");

  const [sessions, changeRequests] = await Promise.all([
    getAdvisorSessions(),
    getAdvisorChangeRequests(),
  ]);

  // Collect all user IDs to display owner names (sessions + change requests).
  const ownerIds = Array.from(
    new Set([
      ...sessions.map((s) => s.owner_id),
      ...changeRequests.map((r) => r.owner_id),
    ]),
  );
  const ownerNames = await getAdvisorOwnerNames(ownerIds);

  return (
    <TrainingWorkspace
      sessions={sessions}
      currentSession={null}
      messages={[]}
      changeRequests={changeRequests}
      contextInfo={null}
      currentUserId={access.user.id}
      ownerNames={ownerNames}
    />
  );
}
