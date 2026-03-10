import { ActivityType, PointTransactionType, TaskCompletionStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { hasValidSameOrigin } from "@/lib/csrf";
import { db } from "@/lib/db";
import { parseJsonBody } from "@/lib/http";
import { createPointTransaction } from "@/lib/points/service";
import { updateChildStreak } from "@/lib/tasks/streak";
import { reviewTaskCompletionSchema } from "@/lib/validation/parent";

interface RouteContext {
  params: Promise<{ completionId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!hasValidSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const auth = await requireApiSession(request, ["PARENT"]);
  if (auth.response) {
    return auth.response;
  }

  const payload = await parseJsonBody(request, reviewTaskCompletionSchema);
  if ("error" in payload) {
    return payload.error;
  }

  const { completionId } = await context.params;

  const completion = await db.taskCompletion.findFirst({
    where: {
      id: completionId,
      task: {
        familyId: auth.session!.familyId
      }
    },
    include: {
      task: true,
      child: true
    }
  });

  if (!completion) {
    return Response.json({ error: "Completion not found" }, { status: 404 });
  }

  if (completion.status !== TaskCompletionStatus.PENDING_APPROVAL) {
    return Response.json({ error: "Completion already reviewed" }, { status: 409 });
  }

  if (payload.data.decision === "APPROVE") {
    const updatedCompletion = await db.taskCompletion.update({
      where: { id: completion.id },
      data: {
        status: TaskCompletionStatus.APPROVED,
        pointsAwarded: completion.task.points,
        reviewedAt: new Date(),
        reviewedById: auth.session!.userId,
        reviewNote: payload.data.note
      }
    });

    await createPointTransaction({
      familyId: auth.session!.familyId,
      childId: completion.childId,
      actorId: auth.session!.userId,
      type: PointTransactionType.TASK_REWARD,
      amount: completion.task.points,
      note: `Task approved: ${completion.task.title}`,
      referenceType: "TASK_COMPLETION",
      referenceId: completion.id
    });

    await updateChildStreak(completion.childId, updatedCompletion.completedAt);

    await db.activityLog.create({
      data: {
        familyId: auth.session!.familyId,
        actorId: auth.session!.userId,
        childId: completion.childId,
        type: ActivityType.TASK_APPROVED,
        message: `${auth.session!.displayName} approved task completion "${completion.task.title}" for ${completion.child.displayName}`,
        metadata: {
          completionId: completion.id,
          note: payload.data.note
        }
      }
    });

    return Response.json({ data: updatedCompletion });
  }

  const updatedCompletion = await db.taskCompletion.update({
    where: { id: completion.id },
    data: {
      status: TaskCompletionStatus.REJECTED,
      pointsAwarded: 0,
      reviewedAt: new Date(),
      reviewedById: auth.session!.userId,
      reviewNote: payload.data.note
    }
  });

  await db.activityLog.create({
    data: {
      familyId: auth.session!.familyId,
      actorId: auth.session!.userId,
      childId: completion.childId,
      type: ActivityType.TASK_REJECTED,
      message: `${auth.session!.displayName} rejected task completion "${completion.task.title}" for ${completion.child.displayName}`,
      metadata: {
        completionId: completion.id,
        note: payload.data.note
      }
    }
  });

  return Response.json({ data: updatedCompletion });
}
