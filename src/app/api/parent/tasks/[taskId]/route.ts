import { ActivityType, Role } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { hasValidSameOrigin } from "@/lib/csrf";
import { db } from "@/lib/db";
import { parseJsonBody } from "@/lib/http";
import { updateTaskSchema } from "@/lib/validation/parent";

interface RouteContext {
  params: Promise<{ taskId: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!hasValidSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const auth = await requireApiSession(request, ["PARENT"]);
  if (auth.response) {
    return auth.response;
  }

  const payload = await parseJsonBody(request, updateTaskSchema);
  if ("error" in payload) {
    return payload.error;
  }

  const { taskId } = await context.params;

  const existingTask = await db.task.findFirst({
    where: {
      id: taskId,
      familyId: auth.session!.familyId
    }
  });

  if (!existingTask) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  const child = await db.user.findFirst({
    where: {
      id: payload.data.assignedChildId,
      familyId: auth.session!.familyId,
      role: Role.CHILD,
      isActive: true
    }
  });

  if (!child) {
    return Response.json({ error: "Child not found" }, { status: 404 });
  }

  const updatedTask = await db.task.update({
    where: { id: existingTask.id },
    data: {
      assignedChildId: payload.data.assignedChildId,
      title: payload.data.title,
      description: payload.data.description,
      points: payload.data.points,
      taskType: payload.data.taskType,
      recurrenceType: payload.data.recurrenceType,
      weekdays: payload.data.weekdays,
      requiresApproval: payload.data.requiresApproval,
      isActive: payload.data.isActive
    }
  });

  await db.activityLog.create({
    data: {
      familyId: auth.session!.familyId,
      actorId: auth.session!.userId,
      childId: payload.data.assignedChildId,
      type: ActivityType.TASK_CREATED,
      message: `${auth.session!.displayName} updated task "${updatedTask.title}" for ${child.displayName}`,
      metadata: {
        taskId: updatedTask.id,
        isActive: updatedTask.isActive,
        recurrenceType: updatedTask.recurrenceType
      }
    }
  });

  return Response.json({ data: updatedTask });
}
