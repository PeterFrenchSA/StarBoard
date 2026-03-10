import {
  ActivityType,
  PointTransactionType,
  Prisma,
  Role,
  TaskCompletionStatus
} from "@prisma/client";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { parseJsonBody } from "@/lib/http";
import { createPointTransaction } from "@/lib/points/service";
import { getRequestIdentity, rateLimit } from "@/lib/rate-limit";
import { canTaskOccurToday, getOccurrenceDate } from "@/lib/tasks/recurrence";
import { updateChildStreak } from "@/lib/tasks/streak";
import { voiceCompleteTaskSchema } from "@/lib/validation/voice";
import { authenticateVoiceToken, parseBearerToken } from "@/lib/voice/token";

export async function POST(request: NextRequest) {
  const bearer = parseBearerToken(request.headers.get("authorization"));
  const voiceToken = await authenticateVoiceToken(bearer);

  if (!voiceToken) {
    return Response.json({ error: "Unauthorized voice token" }, { status: 401 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const limit = rateLimit(getRequestIdentity(ip, `voice-complete-task-${voiceToken.id}`), 60, 60 * 1000);

  if (!limit.allowed) {
    return Response.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const payload = await parseJsonBody(request, voiceCompleteTaskSchema);
  if ("error" in payload) {
    return payload.error;
  }

  const childWhere: Prisma.UserWhereInput = {
    familyId: voiceToken.familyId,
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
    return Response.json({ error: "Child not found" }, { status: 404 });
  }

  const taskWhere: Prisma.TaskWhereInput = {
    familyId: voiceToken.familyId,
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
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  if (!canTaskOccurToday(task)) {
    return Response.json({ error: "Task is not scheduled for today" }, { status: 409 });
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
    return Response.json({ error: "Task already completed today" }, { status: 409 });
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
    familyId: voiceToken.familyId,
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
      familyId: voiceToken.familyId,
      childId: child.id,
      type: ActivityType.VOICE_TASK_COMPLETED,
      message: `Voice action completed task "${task.title}" for ${child.displayName}`,
      metadata: {
        voiceTokenLabel: voiceToken.label,
        completionId: completion.id
      }
    }
  });

  return Response.json({
    data: {
      completionId: completion.id,
      child: child.displayName,
      task: task.title,
      pointsAwarded: task.points
    }
  });
}
