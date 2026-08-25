import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import {
  getAdvisorSessions,
  getAdvisorSession,
  getAdvisorMessages,
  getAdvisorChangeRequests,
} from "@/app/(authenticated)/ai-training/actions";
import { assembleContext } from "@/lib/ai-training/context";
import { TrainingWorkspace } from "@/components/ai-training/training-workspace";

export default async function AiTrainingSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const access = await requireRole(["owner"]);
  if (access.error) redirect("/dashboard?error=access_denied");

  const { sessionId } = await params;

  const [sessions, currentSession, messages, changeRequests, context] =
    await Promise.all([
      getAdvisorSessions(),
      getAdvisorSession(sessionId),
      getAdvisorMessages(sessionId),
      getAdvisorChangeRequests(sessionId),
      assembleContext().catch(() => null),
    ]);

  if (!currentSession) {
    redirect("/ai-training");
  }

  const contextInfo = context
    ? {
        isStale: context.isStale,
        timestamps: context.sourceTimestamps,
      }
    : null;

  return (
    <TrainingWorkspace
      sessions={sessions}
      currentSession={currentSession}
      messages={messages}
      changeRequests={changeRequests}
      contextInfo={contextInfo}
    />
  );
}
