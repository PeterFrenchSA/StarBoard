import {
  ActivityType,
  PointTransactionType,
  Prisma,
  Role,
  TaskCompletionStatus
} from "@prisma/client";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { createPointTransaction } from "@/lib/points/service";
import { canTaskOccurToday, getOccurrenceDate } from "@/lib/tasks/recurrence";
import { updateChildStreak } from "@/lib/tasks/streak";
import { voiceCompleteTaskSchema } from "@/lib/validation/voice";
import { requireVoiceAuth, voiceError, voiceOk } from "@/lib/voice/http";

export async function POST(request: NextRequest) {
  const auth = await requireVoiceAuth(request, { scope: "complete-task" });
  if (auth.response) {
    return auth.response;
  }

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    return voiceError("Invalid JSON payload", 400);
  }

  const payload = voiceCompleteTaskSchema.safeParse(requestBody);
  if (!payload.success) {
    return voiceError(payload.error.issues[0]?.message ?? "Validation failed", 422);
  }

  const childWhere: Prisma.UserWhereInput = {
    familyId: auth.token!.familyId,
    role: Role.CHILD,
    isActive: true
  };

  if (payload.data.childId) {
    childWhere.id = payload.data.childId;
  } else if (payload.data.childName) {
    childWhere.displayName = {
      equals: payload.data.childName,
      mode: "insensitive"
    };
  }

  const child = await db.user.findFirst({ where: childWhere });

  if (!child) {
    return voiceError("Child not found", 404);
  }

  const taskWhere: Prisma.TaskWhereInput = {
    familyId: auth.token!.familyId,
    assignedChildId: child.id,
    isActive: true
  };

  if (payload.data.taskId) {
    taskWhere.id = payload.data.taskId;
  } else if (payload.data.taskTitle) {
    taskWhere.title = {
      equals: payload.data.taskTitle,
      mode: "insensitive"
    };
  }

  const task = await db.task.findFirst({ where: taskWhere });

  if (!task) {
    return voiceError("Task not found", 404);
  }

  if (!canTaskOccurToday(task)) {
    return voiceError("Task is not scheduled for today", 409);
  }

  const occurrenceDate = getOccurrenceDate();

  const existingToday = await db.taskCompletion.findFirst({
    where: {
      taskId: task.id,
      childId: child.id,
      occurrenceDate
    }
  });

  if (existingToday) {
    return voiceError("Task already completed today", 409);
  }

  const completion = await db.taskCompletion.create({
    data: {
      taskId: task.id,
      childId: child.id,
      occurrenceDate,
      status: TaskCompletionStatus.APPROVED,
      pointsAwarded: task.points,
      reviewedAt: new Date(),
      reviewNote: payload.data.note ?? "Completed via voice action"
    }
  });

  await createPointTransaction({
    familyId: auth.token!.familyId,
    childId: child.id,
    actorId: null,
    type: PointTransactionType.TASK_REWARD,
    amount: task.points,
    note: `Voice-completed task: ${task.title}`,
    referenceType: "TASK_COMPLETION",
    referenceId: completion.id
  });

  await updateChildStreak(child.id, completion.completedAt);

  await db.activityLog.create({
    data: {
      familyId: auth.token!.familyId,
      childId: child.id,
      type: ActivityType.VOICE_TASK_COMPLETED,
      message: `Voice action completed task "${task.title}" for ${child.displayName}`,
      metadata: {
        voiceTokenLabel: auth.token!.label,
        completionId: completion.id
      }
    }
  });

  return voiceOk({
    completionId: completion.id,
    child: child.displayName,
    task: task.title,
    pointsAwarded: task.points
  });
}
