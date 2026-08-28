import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import {
  getAdvisorSessions,
  getAdvisorSession,
  getAdvisorMessages,
  getAdvisorChangeRequests,
  getAdvisorOwnerNames,
} from "@/app/(authenticated)/ai-training/actions";
import { assembleContext } from "@/lib/ai-training/context";
import { TrainingWorkspace } from "@/components/ai-training/training-workspace";

export default async function AiTrainingSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const access = await requireRole(["owner", "manager"]);
  if (access.error) redirect("/dashboard?error=access_denied");

  const { sessionId } = await params;

  const [sessions, currentSession, messages, changeRequests, context] =
    await Promise.all([
      getAdvisorSessions(),
      getAdvisorSession(sessionId),
      getAdvisorMessages(sessionId),
      getAdvisorChangeRequests(),
      assembleContext().catch(() => null),
    ]);

  if (!currentSession) {
    redirect("/ai-training");
  }

  // Collect all user IDs to display owner names (sessions + change requests).
  const ownerIds = Array.from(
    new Set([
      ...sessions.map((s) => s.owner_id),
      ...changeRequests.map((r) => r.owner_id),
    ]),
  );
  const ownerNames = await getAdvisorOwnerNames(ownerIds);

  const contextInfo = context
    ? {
        isStale: context.isStale,
        timestamps: context.sourceTimestamps,
      }
    : null;

  return (
    <TrainingWorkspace
      key={currentSession.id}
      sessions={sessions}
      currentSession={currentSession}
      messages={messages}
      changeRequests={changeRequests}
      contextInfo={contextInfo}
      currentUserId={access.user.id}
      ownerNames={ownerNames}
    />
  );
}
