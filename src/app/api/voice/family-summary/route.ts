import { RedemptionStatus, Role, TaskCompletionStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getPointsByChildIds } from "@/lib/points/service";
import { authenticateVoiceToken, parseBearerToken } from "@/lib/voice/token";

export async function GET(request: NextRequest) {
  const bearer = parseBearerToken(request.headers.get("authorization"));
  const voiceToken = await authenticateVoiceToken(bearer);

  if (!voiceToken) {
    return Response.json({ error: "Unauthorized voice token" }, { status: 401 });
  }

  const children = await db.user.findMany({
    where: {
      familyId: voiceToken.familyId,
      role: Role.CHILD,
      isActive: true
    },
    include: {
      childProfile: true
    },
    orderBy: { displayName: "asc" }
  });

  const pointsByChild = await getPointsByChildIds(
    voiceToken.familyId,
    children.map((child) => child.id)
  );

  const [pendingTaskApprovals, pendingRewardRequests] = await Promise.all([
    db.taskCompletion.count({
      where: {
        task: {
          familyId: voiceToken.familyId
        },
        status: TaskCompletionStatus.PENDING_APPROVAL
      }
    }),
    db.rewardRedemption.count({
      where: {
        familyId: voiceToken.familyId,
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

  return Response.json({
    data: {
      familyId: voiceToken.familyId,
      totalChildren: children.length,
      totalPoints,
      pendingTaskApprovals,
      pendingRewardRequests,
      leaderboard: childSummaries.sort((a, b) => b.points - a.points)
    }
  });
}
