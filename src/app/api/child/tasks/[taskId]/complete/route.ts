import { ActivityType, TaskCompletionStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { hasValidSameOrigin } from "@/lib/csrf";
import { db } from "@/lib/db";
import { parseJsonBody } from "@/lib/http";
import { canTaskOccurToday, getOccurrenceDate } from "@/lib/tasks/recurrence";
import { submitTask, TaskSubmissionConflict } from "@/lib/tasks/submit";
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

  const autoApprove = !task.requiresApproval;

  try {
    const completion = await submitTask({
      task,
      childId: auth.session!.userId,
      actorId: auth.session!.userId,
      occurrenceDate,
      status: autoApprove ? TaskCompletionStatus.AUTO_APPROVED : TaskCompletionStatus.PENDING_APPROVAL,
      note: payload.data.note,
      timerSessionId,
      activityType: ActivityType.TASK_COMPLETED,
      activityMessage: `${auth.session!.displayName} completed task "${task.title}"${autoApprove ? " (auto-approved)" : ""}`,
      pointNote: `Task auto-approved: ${task.title}`
    });
    return Response.json({ data: completion }, { status: 201 });
  } catch (error) {
    if (error instanceof TaskSubmissionConflict) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
