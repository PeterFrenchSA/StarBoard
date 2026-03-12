import {
  BillingInterval,
  RedemptionStatus,
  Role,
  SupportTicketStatus,
  TaskCompletionStatus
} from "@prisma/client";
import { startOfMonth } from "date-fns";
import { calculateFamilyPlanPrice } from "@/lib/billing/pricing";
import { db } from "@/lib/db";
import { getChildPoints, getPointsByChildIds } from "@/lib/points/service";
import { canTaskOccurToday, getOccurrenceDate } from "@/lib/tasks/recurrence";

export async function getParentOverviewData(familyId: string) {
  const [family, parents, children, pendingTaskApprovals, pendingRedemptions, tasks, rewards, activity, supportTickets] =
    await Promise.all([
      db.family.findUniqueOrThrow({
        where: { id: familyId },
        select: {
          id: true,
          name: true,
          billingInterval: true,
          subscriptionStatus: true,
          billingEmail: true,
          stripeCustomerId: true,
          subscriptionCurrentPeriodEnd: true,
          subscriptionCancelAtPeriodEnd: true,
          planBaseAmountCents: true,
          includedChildren: true,
          additionalChildAmountCents: true
        }
      }),
      db.user.findMany({
        where: {
          familyId,
          role: Role.PARENT,
          isActive: true
        },
        select: {
          id: true,
          displayName: true,
          email: true,
          isFamilyOwner: true,
          createdAt: true
        },
        orderBy: [{ isFamilyOwner: "desc" }, { displayName: "asc" }]
      }),
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
      }),
      db.supportTicket.findMany({
        where: { familyId },
        include: {
          createdBy: {
            select: {
              id: true,
              displayName: true,
              role: true
            }
          },
          assignedTo: {
            select: {
              id: true,
              displayName: true,
              role: true
            }
          },
          messages: {
            where: {
              isInternal: false
            },
            orderBy: { createdAt: "asc" },
            take: 12,
            include: {
              author: {
                select: {
                  id: true,
                  displayName: true,
                  role: true
                }
              }
            }
          }
        },
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        take: 30
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

  const [monthlyPoints, openSupportTicketsCount] = await Promise.all([
    db.pointTransaction.aggregate({
      where: {
        familyId,
        createdAt: { gte: monthStart },
        amount: { gt: 0 }
      },
      _sum: { amount: true }
    }),
    db.supportTicket.count({
      where: {
        familyId,
        status: {
          in: [SupportTicketStatus.OPEN, SupportTicketStatus.IN_PROGRESS, SupportTicketStatus.WAITING_ON_PARENT]
        }
      }
    })
  ]);

  const monthlyPricing = calculateFamilyPlanPrice({
    childCount: children.length,
    interval: BillingInterval.MONTHLY,
    baseAmountCents: family.planBaseAmountCents,
    includedChildren: family.includedChildren,
    additionalChildAmountCents: family.additionalChildAmountCents
  });

  const annualPricing = calculateFamilyPlanPrice({
    childCount: children.length,
    interval: BillingInterval.ANNUAL,
    baseAmountCents: family.planBaseAmountCents,
    includedChildren: family.includedChildren,
    additionalChildAmountCents: family.additionalChildAmountCents
  });

  return {
    parents,
    children: childrenWithStats,
    pendingTaskApprovals,
    pendingRedemptions,
    tasks,
    rewards,
    supportTickets,
    activity,
    billing: {
      interval: family.billingInterval,
      status: family.subscriptionStatus,
      billingEmail: family.billingEmail,
      stripeCustomerLinked: Boolean(family.stripeCustomerId),
      currentPeriodEnd: family.subscriptionCurrentPeriodEnd,
      cancelAtPeriodEnd: family.subscriptionCancelAtPeriodEnd,
      childCount: children.length,
      includedChildren: family.includedChildren,
      additionalChildren: monthlyPricing.additionalChildren,
      monthlyAmountCents: monthlyPricing.monthlyAmountCents,
      annualAmountCents: annualPricing.billedAmountCents
    },
    stats: {
      childrenCount: children.length,
      activeTasksCount: tasks.length,
      totalPositivePointsThisMonth: monthlyPoints._sum.amount ?? 0,
      pendingApprovalsCount: pendingTaskApprovals.length + pendingRedemptions.length,
      openSupportTicketsCount
    }
  };
}

export async function getChildOverviewData(familyId: string, childId: string) {
  const todayOccurrenceDate = getOccurrenceDate();

  const [child, tasks, completions, rewards, rewardRequests, activity, pointsHistory, timerSessions] =
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
      }),
      db.taskTimerSession.findMany({
        where: {
          childId,
          occurrenceDate: todayOccurrenceDate,
          task: { familyId }
        },
        orderBy: { createdAt: "desc" }
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

  const oneOffSubmittedTaskIds = new Set(
    completions
      .filter(
        (completion) =>
          completion.task.taskType === "ONE_OFF" &&
          completion.status !== TaskCompletionStatus.REJECTED
      )
      .map((completion) => completion.taskId)
  );

  const timerSessionByTaskId = new Map(timerSessions.map((session) => [session.taskId, session]));
  const now = new Date();

  const tasksWithAvailability = tasks.map((task) => {
    const timerSession = timerSessionByTaskId.get(task.id);
    const timerActive = Boolean(timerSession && !timerSession.completedAt && timerSession.expiresAt > now);
    const timerExpired = Boolean(timerSession && !timerSession.completedAt && timerSession.expiresAt <= now);
    const deadlinePassed = Boolean(task.deadlineAt && task.deadlineAt <= now);
    const completedToday = completedTodayTaskIds.has(task.id);
    const oneOffSubmitted = oneOffSubmittedTaskIds.has(task.id);
    const completed = completedToday || oneOffSubmitted;
    const scheduledToday = canTaskOccurToday(task) && !oneOffSubmitted;

    return {
      ...task,
      availableToday: scheduledToday && !deadlinePassed,
      completedToday,
      completed,
      deadlinePassed,
      timerActive,
      timerExpired,
      timerStartedAt: timerSession?.startedAt ?? null,
      timerEndsAt: timerSession?.expiresAt ?? null,
      completedMessage: oneOffSubmitted
        ? "One-off already submitted"
        : completedToday
          ? "Completed today"
          : deadlinePassed
            ? "Deadline passed"
            : timerExpired
              ? "Timer expired. Start again."
              : null
    };
  });

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
