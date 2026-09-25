import {
  ActivityType,
  Prisma,
  Role,
  TaskCompletionStatus
} from "@prisma/client";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { canTaskOccurToday, getOccurrenceDate } from "@/lib/tasks/recurrence";
import { submitTask, TaskSubmissionConflict } from "@/lib/tasks/submit";
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

  if (task.deadlineAt && new Date() > task.deadlineAt) {
    return voiceError("Task deadline has passed", 409);
  }

  if (task.timerDurationMinutes) {
    return voiceError("Task requires an in-app timer. Use the child dashboard for this task.", 409);
  }

  const occurrenceDate = getOccurrenceDate();

  try {
    const completion = await submitTask({
      task,
      childId: child.id,
      actorId: null,
      occurrenceDate,
      status: TaskCompletionStatus.APPROVED,
      note: payload.data.note ?? "Completed via voice action",
      activityType: ActivityType.VOICE_TASK_COMPLETED,
      activityMessage: `Voice action completed task "${task.title}" for ${child.displayName}`,
      pointNote: `Voice-completed task: ${task.title}`,
      voiceTokenLabel: auth.token!.label
    });
    return voiceOk({
      completionId: completion.id,
      child: child.displayName,
      task: task.title,
      pointsAwarded: task.points
    });
  } catch (error) {
    if (error instanceof TaskSubmissionConflict) {
      return voiceError(error.message, 409);
    }
    throw error;
  }
}
