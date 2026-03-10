import { Prisma, RedemptionStatus, Role, TaskCompletionStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getChildPoints } from "@/lib/points/service";
import { voiceChildSummaryQuerySchema } from "@/lib/validation/voice";
import { requireVoiceAuth, voiceError, voiceOk } from "@/lib/voice/http";

export async function GET(request: NextRequest) {
  const auth = await requireVoiceAuth(request, { scope: "child-summary", maxRequests: 100 });
  if (auth.response) {
    return auth.response;
  }

  const queryResult = voiceChildSummaryQuerySchema.safeParse({
    childId: request.nextUrl.searchParams.get("childId") ?? undefined,
    childName: request.nextUrl.searchParams.get("childName") ?? undefined
  });

  if (!queryResult.success) {
    return voiceError(queryResult.error.issues[0]?.message ?? "Validation failed", 422);
  }

  const childWhere: Prisma.UserWhereInput = {
    familyId: auth.token!.familyId,
    role: Role.CHILD,
    isActive: true
  };

  if (queryResult.data.childId) {
    childWhere.id = queryResult.data.childId;
  } else if (queryResult.data.childName) {
    childWhere.displayName = {
      equals: queryResult.data.childName,
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
    return voiceError("Child not found", 404);
  }

  const [points, pendingTasks, pendingRewards] = await Promise.all([
    getChildPoints(auth.token!.familyId, child.id),
    db.taskCompletion.count({
      where: {
        childId: child.id,
        status: TaskCompletionStatus.PENDING_APPROVAL
      }
    }),
    db.rewardRedemption.count({
      where: {
        childId: child.id,
        familyId: auth.token!.familyId,
        status: RedemptionStatus.REQUESTED
      }
    })
  ]);

  return voiceOk({
    id: child.id,
    name: child.displayName,
    points,
    currentStreak: child.childProfile?.currentStreak ?? 0,
    longestStreak: child.childProfile?.longestStreak ?? 0,
    pendingTaskApprovals: pendingTasks,
    pendingRewardRequests: pendingRewards
  });
}
