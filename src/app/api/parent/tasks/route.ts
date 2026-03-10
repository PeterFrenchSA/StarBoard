import { ActivityType, Role } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { hasValidSameOrigin } from "@/lib/csrf";
import { db } from "@/lib/db";
import { parseJsonBody } from "@/lib/http";
import { createTaskSchema } from "@/lib/validation/parent";

export async function POST(request: NextRequest) {
  if (!hasValidSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const auth = await requireApiSession(request, ["PARENT"]);
  if (auth.response) {
    return auth.response;
  }

  const payload = await parseJsonBody(request, createTaskSchema);

  if ("error" in payload) {
    return payload.error;
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

  const task = await db.task.create({
    data: {
      familyId: auth.session!.familyId,
      createdById: auth.session!.userId,
      assignedChildId: payload.data.assignedChildId,
      title: payload.data.title,
      description: payload.data.description,
      points: payload.data.points,
      taskType: payload.data.taskType,
      recurrenceType: payload.data.recurrenceType,
      weekdays: payload.data.weekdays,
      requiresApproval: payload.data.requiresApproval
    }
  });

  await db.activityLog.create({
    data: {
      familyId: auth.session!.familyId,
      actorId: auth.session!.userId,
      childId: payload.data.assignedChildId,
      type: ActivityType.TASK_CREATED,
      message: `${auth.session!.displayName} created task "${task.title}" for ${child.displayName}`,
      metadata: {
        taskId: task.id,
        recurrenceType: task.recurrenceType
      }
    }
  });

  return Response.json({ data: task }, { status: 201 });
}
