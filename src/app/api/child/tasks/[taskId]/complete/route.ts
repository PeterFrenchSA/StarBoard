import { ActivityType, PointTransactionType, TaskCompletionStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { hasValidSameOrigin } from "@/lib/csrf";
import { db } from "@/lib/db";
import { parseJsonBody } from "@/lib/http";
import { createPointTransaction } from "@/lib/points/service";
import { canTaskOccurToday, getOccurrenceDate } from "@/lib/tasks/recurrence";
import { updateChildStreak } from "@/lib/tasks/streak";
import { completeTaskSchema } from "@/lib/validation/child";

interface RouteContext {
  params: Promise<{ taskId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!hasValidSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const auth = await requireApiSession(request, ["CHILD"]);
  if (auth.response) {
    return auth.response;
  }

  const payload = await parseJsonBody(request, completeTaskSchema);
  if ("error" in payload) {
    return payload.error;
  }

  const { taskId } = await context.params;

  const task = await db.task.findFirst({
    where: {
      id: taskId,
      familyId: auth.session!.familyId,
      assignedChildId: auth.session!.userId,
      isActive: true
    }
  });

  if (!task) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  if (!canTaskOccurToday(task)) {
    return Response.json({ error: "Task is not scheduled for today" }, { status: 409 });
  }

  const now = new Date();

  if (task.deadlineAt && now > task.deadlineAt) {
    return Response.json({ error: "Task deadline has passed" }, { status: 409 });
  }

  const occurrenceDate = getOccurrenceDate();

  if (task.taskType === "ONE_OFF") {
    const alreadyDone = await db.taskCompletion.findFirst({
      where: {
        taskId: task.id,
        childId: auth.session!.userId,
        status: {
          in: [
            TaskCompletionStatus.PENDING_APPROVAL,
            TaskCompletionStatus.APPROVED,
            TaskCompletionStatus.AUTO_APPROVED
          ]
        }
      }
    });

    if (alreadyDone) {
      return Response.json({ error: "One-off task already submitted" }, { status: 409 });
    }
  }

  let timerSessionId: string | null = null;

  if (task.timerDurationMinutes) {
    const timerSession = await db.taskTimerSession.findUnique({
      where: {
        taskId_childId_occurrenceDate: {
          taskId: task.id,
          childId: auth.session!.userId,
          occurrenceDate
        }
      }
    });

    if (!timerSession) {
      return Response.json({ error: "Start the task timer before completing this task" }, { status: 409 });
    }

    if (timerSession.completedAt) {
      return Response.json({ error: "Task timer already used" }, { status: 409 });
    }

    if (timerSession.expiresAt <= now) {
      return Response.json({ error: "Task timer expired. Start a new timer." }, { status: 409 });
    }

    timerSessionId = timerSession.id;
  }

  const existingToday = await db.taskCompletion.findFirst({
    where: {
      taskId: task.id,
      childId: auth.session!.userId,
      occurrenceDate
    }
  });

  if (existingToday) {
    return Response.json({ error: "Task already submitted today" }, { status: 409 });
  }

  const autoApprove = !task.requiresApproval;

  const completion = await db.$transaction(async (tx) => {
    const createdCompletion = await tx.taskCompletion.create({
      data: {
        taskId: task.id,
        childId: auth.session!.userId,
        occurrenceDate,
        status: autoApprove ? TaskCompletionStatus.AUTO_APPROVED : TaskCompletionStatus.PENDING_APPROVAL,
        pointsAwarded: autoApprove ? task.points : 0,
        reviewNote: payload.data.note,
        reviewedAt: autoApprove ? new Date() : null,
        reviewedById: autoApprove ? auth.session!.userId : null
      }
    });

    if (timerSessionId) {
      await tx.taskTimerSession.update({
        where: { id: timerSessionId },
        data: { completedAt: new Date() }
      });
    }

    return createdCompletion;
  });

  await db.activityLog.create({
    data: {
      familyId: auth.session!.familyId,
      actorId: auth.session!.userId,
      childId: auth.session!.userId,
      type: ActivityType.TASK_COMPLETED,
      message: `${auth.session!.displayName} completed task "${task.title}"${autoApprove ? " (auto-approved)" : ""}`,
      metadata: {
        completionId: completion.id,
        note: payload.data.note,
        usedTimer: Boolean(task.timerDurationMinutes),
        timerSessionId
      }
    }
  });

  if (autoApprove) {
    await createPointTransaction({
      familyId: auth.session!.familyId,
      childId: auth.session!.userId,
      actorId: auth.session!.userId,
      type: PointTransactionType.TASK_REWARD,
      amount: task.points,
      note: `Task auto-approved: ${task.title}`,
      referenceType: "TASK_COMPLETION",
      referenceId: completion.id
    });

    await updateChildStreak(auth.session!.userId, completion.completedAt);
  }

  return Response.json({ data: completion }, { status: 201 });
}
