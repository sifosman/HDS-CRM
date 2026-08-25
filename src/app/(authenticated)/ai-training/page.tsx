import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import {
  getAdvisorSessions,
  getAdvisorChangeRequests,
} from "@/app/(authenticated)/ai-training/actions";
import { TrainingWorkspace } from "@/components/ai-training/training-workspace";

export default async function AiTrainingPage() {
  const access = await requireRole(["owner"]);
  if (access.error) redirect("/dashboard?error=access_denied");

  const [sessions, changeRequests] = await Promise.all([
    getAdvisorSessions(),
    getAdvisorChangeRequests(),
  ]);

  return (
    <TrainingWorkspace
      sessions={sessions}
      currentSession={null}
      messages={[]}
      changeRequests={changeRequests}
      contextInfo={null}
    />
  );
}
