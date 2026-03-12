import { ActivityType, Role } from "@prisma/client";
import { NextRequest } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import { requireApiSession } from "@/lib/auth/session";
import { hasValidSameOrigin } from "@/lib/csrf";
import { db } from "@/lib/db";
import { parseJsonBody } from "@/lib/http";
import { completeOnboardingSchema, type CompleteOnboardingInput } from "@/lib/validation/onboarding";

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  if (!hasValidSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const auth = await requireApiSession(request, ["PARENT"]);
  if (auth.response) {
    return auth.response;
  }

  const parent = await db.user.findFirst({
    where: {
      id: auth.session!.userId,
      familyId: auth.session!.familyId,
      role: Role.PARENT,
      isActive: true
    },
    select: {
      id: true,
      displayName: true,
      onboardingCompletedAt: true
    }
  });

  if (!parent) {
    return Response.json({ error: "Parent account not found" }, { status: 404 });
  }

  if (parent.onboardingCompletedAt) {
    return Response.json({ error: "Setup wizard already completed for this parent" }, { status: 409 });
  }

  const payload = await parseJsonBody(request, completeOnboardingSchema);
  if ("error" in payload) {
    return payload.error;
  }
  const data: CompleteOnboardingInput = payload.data;

  const normalizedChildren = data.children.map((child) => ({
    ...child,
    email: normalizeEmail(child.email)
  }));

  const uniqueChildEmails = new Set(normalizedChildren.map((child) => child.email));
  if (uniqueChildEmails.size !== normalizedChildren.length) {
    return Response.json({ error: "Child emails must be unique" }, { status: 422 });
  }

  if (normalizedChildren.length > 0) {
    const existingUsers = await db.user.findMany({
      where: {
        email: {
          in: normalizedChildren.map((child) => child.email)
        }
      },
      select: {
        email: true
      }
    });

    if (existingUsers.length > 0) {
      return Response.json(
        {
          error: `Email already in use: ${existingUsers[0].email}`
        },
        { status: 409 }
      );
    }
  }

  const existingChildren = await db.user.findMany({
    where: {
      familyId: auth.session!.familyId,
      role: Role.CHILD,
      isActive: true
    },
    select: {
      id: true,
      email: true,
      displayName: true
    }
  });

  const availableChildEmails = new Set([
    ...existingChildren.map((child) => normalizeEmail(child.email)),
    ...normalizedChildren.map((child) => child.email)
  ]);

  const invalidTask = data.tasks.find(
    (task) => !availableChildEmails.has(normalizeEmail(task.assignedChildEmail))
  );

  if (invalidTask) {
    return Response.json(
      { error: `Task child email is not part of this family: ${invalidTask.assignedChildEmail}` },
      { status: 422 }
    );
  }

  const result = await db.$transaction(async (tx) => {
    await tx.family.update({
      where: { id: auth.session!.familyId },
      data: {
        name: data.familyName,
        themePreset: data.themePreset
      }
    });

    const createdChildren: Array<{ id: string; email: string; displayName: string }> = [];

    for (const child of normalizedChildren) {
      const passwordHash = await hashPassword(child.password);
      const created = await tx.user.create({
        data: {
          familyId: auth.session!.familyId,
          role: Role.CHILD,
          email: child.email,
          passwordHash,
          displayName: child.childName,
          childProfile: {
            create: {
              avatarEmoji: child.avatarEmoji
            }
          }
        },
        select: {
          id: true,
          email: true,
          displayName: true
        }
      });

      createdChildren.push(created);

      await tx.activityLog.create({
        data: {
          familyId: auth.session!.familyId,
          actorId: parent.id,
          childId: created.id,
          type: ActivityType.USER_CREATED,
          message: `${parent.displayName} created child account for ${created.displayName}`
        }
      });
    }

    const allChildrenByEmail = new Map(
      [...existingChildren, ...createdChildren].map((child) => [normalizeEmail(child.email), child])
    );

    let taskCount = 0;

    for (const task of data.tasks) {
      const child = allChildrenByEmail.get(normalizeEmail(task.assignedChildEmail));

      if (!child) {
        continue;
      }

      const createdTask = await tx.task.create({
        data: {
          familyId: auth.session!.familyId,
          createdById: parent.id,
          assignedChildId: child.id,
          title: task.title,
          description: task.description,
          points: task.points,
          taskType: task.taskType,
          recurrenceType: task.recurrenceType,
          weekdays: task.weekdays,
          requiresApproval: task.requiresApproval
        }
      });

      taskCount += 1;

      await tx.activityLog.create({
        data: {
          familyId: auth.session!.familyId,
          actorId: parent.id,
          childId: child.id,
          type: ActivityType.TASK_CREATED,
          message: `${parent.displayName} added starter task "${createdTask.title}" for ${child.displayName}`,
          metadata: {
            taskId: createdTask.id,
            onboarding: true
          }
        }
      });
    }

    let rewardCount = 0;

    for (const reward of data.rewards) {
      const createdReward = await tx.reward.create({
        data: {
          familyId: auth.session!.familyId,
          createdById: parent.id,
          title: reward.title,
          description: reward.description,
          cost: reward.cost,
          iconEmoji: reward.iconEmoji
        }
      });

      rewardCount += 1;

      await tx.activityLog.create({
        data: {
          familyId: auth.session!.familyId,
          actorId: parent.id,
          type: ActivityType.REWARD_CREATED,
          message: `${parent.displayName} added starter reward "${createdReward.title}"`,
          metadata: {
            rewardId: createdReward.id,
            onboarding: true
          }
        }
      });
    }

    await tx.user.update({
      where: { id: parent.id },
      data: {
        onboardingCompletedAt: new Date()
      }
    });

    await tx.activityLog.create({
      data: {
        familyId: auth.session!.familyId,
        actorId: parent.id,
        type: ActivityType.USER_CREATED,
        message: `${parent.displayName} completed onboarding setup wizard`,
        metadata: {
          childrenCreated: createdChildren.length,
          tasksCreated: taskCount,
          rewardsCreated: rewardCount,
          themePreset: data.themePreset
        }
      }
    });

    return {
      childrenCreated: createdChildren.length,
      tasksCreated: taskCount,
      rewardsCreated: rewardCount
    };
  });

  return Response.json({ data: result }, { status: 201 });
}
