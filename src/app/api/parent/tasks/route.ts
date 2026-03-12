import { ActivityType, Role } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { hasValidSameOrigin } from "@/lib/csrf";
import { db } from "@/lib/db";
import { parseJsonBody } from "@/lib/http";
import { createTaskSchema, type CreateTaskInput } from "@/lib/validation/parent";

function getTargetChildIds(input: CreateTaskInput): string[] {
  const childIds = new Set<string>([
    ...(input.assignedChildId ? [input.assignedChildId] : []),
    ...(input.assignedChildIds ?? [])
  ]);

  return Array.from(childIds);
}

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

  const targetChildIds = getTargetChildIds(payload.data);

  if (targetChildIds.length === 0) {
    return Response.json({ error: "Select at least one child" }, { status: 422 });
  }

  const children = await db.user.findMany({
    where: {
      id: { in: targetChildIds },
      familyId: auth.session!.familyId,
      role: Role.CHILD,
      isActive: true
    },
    select: {
      id: true,
      displayName: true
    }
  });

  if (children.length !== targetChildIds.length) {
    return Response.json({ error: "One or more selected children were not found" }, { status: 404 });
  }

  const childById = new Map(children.map((child) => [child.id, child]));
  const orderedChildren = targetChildIds.map((childId) => childById.get(childId)!);

  const createdTasks = await db.$transaction(async (tx) => {
    const tasks = [];

    for (const child of orderedChildren) {
      const task = await tx.task.create({
        data: {
          familyId: auth.session!.familyId,
          createdById: auth.session!.userId,
          assignedChildId: child.id,
          title: payload.data.title,
          description: payload.data.description,
          points: payload.data.points,
          taskType: payload.data.taskType,
          recurrenceType: payload.data.recurrenceType,
          weekdays: payload.data.weekdays,
          deadlineAt: payload.data.deadlineAt ?? null,
          timerDurationMinutes: payload.data.timerDurationMinutes ?? null,
          requiresApproval: payload.data.requiresApproval
        }
      });

      await tx.activityLog.create({
        data: {
          familyId: auth.session!.familyId,
          actorId: auth.session!.userId,
          childId: child.id,
          type: ActivityType.TASK_CREATED,
          message: `${auth.session!.displayName} created task "${task.title}" for ${child.displayName}`,
          metadata: {
            taskId: task.id,
            recurrenceType: task.recurrenceType,
            deadlineAt: task.deadlineAt,
            timerDurationMinutes: task.timerDurationMinutes,
            createdForMultipleChildren: orderedChildren.length > 1
          }
        }
      });

      tasks.push(task);
    }

    return tasks;
  });

  if (createdTasks.length === 1) {
    return Response.json({ data: createdTasks[0] }, { status: 201 });
  }

  return Response.json(
    {
      data: {
        createdCount: createdTasks.length,
        tasks: createdTasks
      }
    },
    { status: 201 }
  );
}
