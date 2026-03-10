import { Prisma, RedemptionStatus, Role, TaskCompletionStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getChildPoints } from "@/lib/points/service";
import { authenticateVoiceToken, parseBearerToken } from "@/lib/voice/token";

export async function GET(request: NextRequest) {
  const bearer = parseBearerToken(request.headers.get("authorization"));
  const voiceToken = await authenticateVoiceToken(bearer);

  if (!voiceToken) {
    return Response.json({ error: "Unauthorized voice token" }, { status: 401 });
  }

  const childId = request.nextUrl.searchParams.get("childId");
  const childName = request.nextUrl.searchParams.get("childName");

  if (!childId && !childName) {
    return Response.json({ error: "Provide childId or childName" }, { status: 400 });
  }

  const childWhere: Prisma.UserWhereInput = {
    familyId: voiceToken.familyId,
    role: Role.CHILD,
    isActive: true
  };

  if (childId) {
    childWhere.id = childId;
  } else if (childName) {
    childWhere.displayName = {
      equals: childName,
      mode: "insensitive"
    };
  }

  const child = await db.user.findFirst({
    where: childWhere,
    include: {
      childProfile: true
    }
  });

  if (!child) {
    return Response.json({ error: "Child not found" }, { status: 404 });
  }

  const [points, pendingTasks, pendingRewards] = await Promise.all([
    getChildPoints(voiceToken.familyId, child.id),
    db.taskCompletion.count({
      where: {
        childId: child.id,
        status: TaskCompletionStatus.PENDING_APPROVAL
      }
    }),
    db.rewardRedemption.count({
      where: {
        childId: child.id,
        familyId: voiceToken.familyId,
        status: RedemptionStatus.REQUESTED
      }
    })
  ]);

  return Response.json({
    data: {
      id: child.id,
      name: child.displayName,
      points,
      currentStreak: child.childProfile?.currentStreak ?? 0,
      longestStreak: child.childProfile?.longestStreak ?? 0,
      pendingTaskApprovals: pendingTasks,
      pendingRewardRequests: pendingRewards
    }
  });
}
