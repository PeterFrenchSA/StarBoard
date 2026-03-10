import { RedemptionStatus, Role, TaskCompletionStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getPointsByChildIds } from "@/lib/points/service";
import { requireVoiceAuth, voiceOk } from "@/lib/voice/http";

export async function GET(request: NextRequest) {
  const auth = await requireVoiceAuth(request, { scope: "family-summary", maxRequests: 120 });
  if (auth.response) {
    return auth.response;
  }

  const children = await db.user.findMany({
    where: {
      familyId: auth.token!.familyId,
      role: Role.CHILD,
      isActive: true
    },
    include: {
      childProfile: true
    },
    orderBy: { displayName: "asc" }
  });

  const pointsByChild = await getPointsByChildIds(
    auth.token!.familyId,
    children.map((child) => child.id)
  );

  const [pendingTaskApprovals, pendingRewardRequests] = await Promise.all([
    db.taskCompletion.count({
      where: {
        task: {
          familyId: auth.token!.familyId
        },
        status: TaskCompletionStatus.PENDING_APPROVAL
      }
    }),
    db.rewardRedemption.count({
      where: {
        familyId: auth.token!.familyId,
        status: RedemptionStatus.REQUESTED
      }
    })
  ]);

  const childSummaries = children.map((child) => ({
    id: child.id,
    name: child.displayName,
    points: pointsByChild[child.id] ?? 0,
    streak: child.childProfile?.currentStreak ?? 0
  }));

  const totalPoints = childSummaries.reduce((sum, child) => sum + child.points, 0);

  return voiceOk({
    familyId: auth.token!.familyId,
    totalChildren: children.length,
    totalPoints,
    pendingTaskApprovals,
    pendingRewardRequests,
    leaderboard: childSummaries.sort((a, b) => b.points - a.points)
  });
}
