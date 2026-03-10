import { TaskCompletionStatus, RedemptionStatus, Role } from "@prisma/client";
import { startOfMonth } from "date-fns";
import { db } from "@/lib/db";
import { getChildPoints, getPointsByChildIds } from "@/lib/points/service";
import { canTaskOccurToday } from "@/lib/tasks/recurrence";

export async function getParentOverviewData(familyId: string) {
  const [children, pendingTaskApprovals, pendingRedemptions, tasks, rewards, activity] =
    await Promise.all([
      db.user.findMany({
        where: { familyId, role: Role.CHILD, isActive: true },
        include: {
          childProfile: true
        },
        orderBy: { displayName: "asc" }
      }),
      db.taskCompletion.findMany({
        where: {
          task: { familyId },
          status: TaskCompletionStatus.PENDING_APPROVAL
        },
        include: {
          task: true,
          child: {
            include: { childProfile: true }
          }
        },
        orderBy: { completedAt: "desc" },
        take: 20
      }),
      db.rewardRedemption.findMany({
        where: {
          familyId,
          status: RedemptionStatus.REQUESTED
        },
        include: {
          reward: true,
          child: {
            include: { childProfile: true }
          }
        },
        orderBy: { requestedAt: "desc" },
        take: 20
      }),
      db.task.findMany({
        where: { familyId, isActive: true },
        include: {
          assignedChild: {
            include: { childProfile: true }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 40
      }),
      db.reward.findMany({
        where: { familyId, isActive: true },
        orderBy: { createdAt: "desc" },
        take: 20
      }),
      db.activityLog.findMany({
        where: { familyId },
        include: {
          actor: true,
          child: true
        },
        orderBy: { createdAt: "desc" },
        take: 50
      })
    ]);

  const pointsByChild = await getPointsByChildIds(
    familyId,
    children.map((child) => child.id)
  );

  const childrenWithStats = children.map((child) => ({
    ...child,
    points: pointsByChild[child.id] ?? 0,
    pendingTasks: pendingTaskApprovals.filter((entry) => entry.childId === child.id).length,
    pendingRewards: pendingRedemptions.filter((entry) => entry.childId === child.id).length
  }));

  const monthStart = startOfMonth(new Date());
  const monthlyPoints = await db.pointTransaction.aggregate({
    where: {
      familyId,
      createdAt: { gte: monthStart },
      amount: { gt: 0 }
    },
    _sum: { amount: true }
  });

  return {
    children: childrenWithStats,
    pendingTaskApprovals,
    pendingRedemptions,
    tasks,
    rewards,
    activity,
    stats: {
      childrenCount: children.length,
      activeTasksCount: tasks.length,
      totalPositivePointsThisMonth: monthlyPoints._sum.amount ?? 0,
      pendingApprovalsCount: pendingTaskApprovals.length + pendingRedemptions.length
    }
  };
}

export async function getChildOverviewData(familyId: string, childId: string) {
  const [child, tasks, completions, rewards, rewardRequests, activity, pointsHistory] =
    await Promise.all([
      db.user.findFirstOrThrow({
        where: {
          id: childId,
          familyId,
          role: Role.CHILD
        },
        include: {
          childProfile: true
        }
      }),
      db.task.findMany({
        where: {
          familyId,
          assignedChildId: childId,
          isActive: true
        },
        orderBy: [{ taskType: "desc" }, { createdAt: "desc" }]
      }),
      db.taskCompletion.findMany({
        where: {
          task: { familyId },
          childId
        },
        include: {
          task: true,
          reviewedBy: true
        },
        orderBy: { completedAt: "desc" },
        take: 50
      }),
      db.reward.findMany({
        where: {
          familyId,
          isActive: true
        },
        orderBy: { cost: "asc" }
      }),
      db.rewardRedemption.findMany({
        where: {
          familyId,
          childId
        },
        include: { reward: true },
        orderBy: { requestedAt: "desc" },
        take: 20
      }),
      db.activityLog.findMany({
        where: {
          familyId,
          childId
        },
        include: {
          actor: true
        },
        orderBy: { createdAt: "desc" },
        take: 30
      }),
      db.pointTransaction.findMany({
        where: { familyId, childId },
        include: { actor: true },
        orderBy: { createdAt: "desc" },
        take: 30
      })
    ]);

  const points = await getChildPoints(familyId, childId);

  const completedTodayTaskIds = new Set(
    completions
      .filter((completion) => {
        const completionDate = new Date(completion.occurrenceDate);
        const now = new Date();
        return (
          completionDate.getFullYear() === now.getFullYear() &&
          completionDate.getMonth() === now.getMonth() &&
          completionDate.getDate() === now.getDate()
        );
      })
      .map((completion) => completion.taskId)
  );

  const tasksWithAvailability = tasks.map((task) => ({
    ...task,
    availableToday: canTaskOccurToday(task),
    completedToday: completedTodayTaskIds.has(task.id)
  }));

  const rewardsWithProgress = rewards.map((reward) => {
    const progress = Math.min(100, Math.round((points / reward.cost) * 100));
    return {
      ...reward,
      affordable: points >= reward.cost,
      progress
    };
  });

  const badgeList = [
    {
      id: "first-steps",
      label: "First Steps",
      earned: points >= 20
    },
    {
      id: "streak-starter",
      label: "Streak Starter",
      earned: (child.childProfile?.currentStreak ?? 0) >= 3
    },
    {
      id: "star-master",
      label: "Star Master",
      earned: points >= 150
    }
  ];

  return {
    child,
    tasks: tasksWithAvailability,
    completions,
    rewards: rewardsWithProgress,
    rewardRequests,
    activity,
    points,
    pointsHistory,
    badges: badgeList
  };
}
