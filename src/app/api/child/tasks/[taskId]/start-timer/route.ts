import { TaskCompletionStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { hasValidSameOrigin } from "@/lib/csrf";
import { db } from "@/lib/db";
import { canTaskOccurToday, getOccurrenceDate } from "@/lib/tasks/recurrence";

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

  if (!task.timerDurationMinutes) {
    return Response.json({ error: "This task does not have a timer" }, { status: 409 });
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
    const oneOffSubmitted = await db.taskCompletion.findFirst({
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

    if (oneOffSubmitted) {
      return Response.json({ error: "One-off task already submitted" }, { status: 409 });
    }
  }

  const existingCompletion = await db.taskCompletion.findFirst({
    where: {
      taskId: task.id,
      childId: auth.session!.userId,
      occurrenceDate
    }
  });

  if (existingCompletion) {
    return Response.json({ error: "Task already submitted today" }, { status: 409 });
  }

  const existingTimer = await db.taskTimerSession.findUnique({
    where: {
      taskId_childId_occurrenceDate: {
        taskId: task.id,
        childId: auth.session!.userId,
        occurrenceDate
      }
    }
  });

  if (existingTimer?.completedAt) {
    return Response.json({ error: "Task timer already used" }, { status: 409 });
  }

  if (existingTimer && existingTimer.expiresAt > now) {
    return Response.json({
      data: {
        id: existingTimer.id,
        taskId: existingTimer.taskId,
        startedAt: existingTimer.startedAt,
        expiresAt: existingTimer.expiresAt,
        remainingSeconds: Math.max(0, Math.floor((existingTimer.expiresAt.getTime() - now.getTime()) / 1000))
      }
    });
  }

  const expiresAt = new Date(now.getTime() + task.timerDurationMinutes * 60 * 1000);

  const timerSession = await db.taskTimerSession.upsert({
    where: {
      taskId_childId_occurrenceDate: {
        taskId: task.id,
        childId: auth.session!.userId,
        occurrenceDate
      }
    },
    update: {
      startedAt: now,
      expiresAt,
      completedAt: null
    },
    create: {
      taskId: task.id,
      childId: auth.session!.userId,
      occurrenceDate,
      startedAt: now,
      expiresAt
    }
  });

  return Response.json({
    data: {
      id: timerSession.id,
      taskId: timerSession.taskId,
      startedAt: timerSession.startedAt,
      expiresAt: timerSession.expiresAt,
      remainingSeconds: Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000))
    }
  });
}
