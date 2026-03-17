import {
  BillingInterval,
  RedemptionStatus,
  Prisma,
  Role,
  SupportTicketStatus,
  TaskCompletionStatus
} from "@prisma/client";
import { startOfMonth } from "date-fns";
import { calculateFamilyPlanPrice } from "@/lib/billing/pricing";
import { db } from "@/lib/db";
import { getChildPoints, getPointsByChildIds } from "@/lib/points/service";
import { canTaskOccurToday, getOccurrenceDate } from "@/lib/tasks/recurrence";

const childProfileSummarySelect = Prisma.validator<Prisma.ChildProfileSelect>()({
  avatarEmoji: true,
  colorTheme: true,
  currentStreak: true,
  longestStreak: true
});

const childUserSummarySelect = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  displayName: true,
  email: true,
  childProfile: {
    select: childProfileSummarySelect
  }
});

const activityActorSelect = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  displayName: true,
  role: true
});

function toChildSummary(child: {
  id: string;
  displayName: string;
  email: string;
  childProfile: {
    avatarEmoji: string;
    colorTheme: string;
    currentStreak: number;
    longestStreak: number;
  } | null;
}) {
  return {
    id: child.id,
    displayName: child.displayName,
    email: child.email,
    childProfile: child.childProfile
      ? {
          avatarEmoji: child.childProfile.avatarEmoji,
          colorTheme: child.childProfile.colorTheme,
          currentStreak: child.childProfile.currentStreak,
          longestStreak: child.childProfile.longestStreak
        }
      : null
  };
}

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
        select: childUserSummarySelect,
        orderBy: { displayName: "asc" }
      }),
      db.taskCompletion.findMany({
        where: {
          task: { familyId },
          status: TaskCompletionStatus.PENDING_APPROVAL
        },
        include: {
          task: {
            select: {
              id: true,
              title: true,
              points: true
            }
          },
          child: {
            select: {
              id: true,
              displayName: true,
              childProfile: {
                select: {
                  avatarEmoji: true
                }
              }
            }
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
          reward: {
            select: {
              id: true,
              title: true,
              iconEmoji: true
            }
          },
          child: {
            select: {
              id: true,
              displayName: true,
              childProfile: {
                select: {
                  avatarEmoji: true
                }
              }
            }
          }
        },
        orderBy: { requestedAt: "desc" },
        take: 20
      }),
      db.task.findMany({
        where: { familyId, isActive: true },
        include: {
          assignedChild: {
            select: {
              id: true,
              displayName: true,
              childProfile: {
                select: {
                  avatarEmoji: true
                }
              }
            }
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
          actor: {
            select: activityActorSelect
          },
          child: {
            select: {
              id: true,
              displayName: true
            }
          }
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
    ...toChildSummary(child),
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
    pendingTaskApprovals: pendingTaskApprovals.map((entry) => ({
      id: entry.id,
      completedAt: entry.completedAt,
      task: {
        title: entry.task.title,
        points: entry.task.points
      },
      child: {
        displayName: entry.child.displayName,
        childProfile: entry.child.childProfile
          ? {
              avatarEmoji: entry.child.childProfile.avatarEmoji
            }
          : null
      }
    })),
    pendingRedemptions: pendingRedemptions.map((entry) => ({
      id: entry.id,
      requestedAt: entry.requestedAt,
      pointsCost: entry.pointsCost,
      reward: {
        title: entry.reward.title,
        iconEmoji: entry.reward.iconEmoji
      },
      child: {
        displayName: entry.child.displayName,
        childProfile: entry.child.childProfile
          ? {
              avatarEmoji: entry.child.childProfile.avatarEmoji
            }
          : null
      }
    })),
    tasks: tasks.map((task) => ({
      id: task.id,
      assignedChildId: task.assignedChildId,
      title: task.title,
      description: task.description,
      points: task.points,
      taskType: task.taskType,
      recurrenceType: task.recurrenceType,
      weekdays: task.weekdays,
      deadlineAt: task.deadlineAt,
      timerDurationMinutes: task.timerDurationMinutes,
      requiresApproval: task.requiresApproval,
      isActive: task.isActive,
      assignedChild: {
        id: task.assignedChild.id,
        displayName: task.assignedChild.displayName,
        childProfile: task.assignedChild.childProfile
          ? {
              avatarEmoji: task.assignedChild.childProfile.avatarEmoji
            }
          : null
      }
    })),
    rewards: rewards.map((reward) => ({
      id: reward.id,
      title: reward.title,
      description: reward.description,
      cost: reward.cost,
      iconEmoji: reward.iconEmoji,
      isActive: reward.isActive
    })),
    supportTickets,
    activity: activity.map((entry) => ({
      id: entry.id,
      type: entry.type,
      message: entry.message,
      createdAt: entry.createdAt,
      actor: entry.actor
        ? {
            displayName: entry.actor.displayName
          }
        : null,
      child: entry.child
        ? {
            displayName: entry.child.displayName
          }
        : null
    })),
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
        select: childUserSummarySelect
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
          task: {
            select: {
              id: true,
              title: true,
              taskType: true
            }
          },
          reviewedBy: {
            select: activityActorSelect
          }
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
        include: {
          reward: {
            select: {
              id: true,
              title: true,
              iconEmoji: true,
              cost: true
            }
          }
        },
        orderBy: { requestedAt: "desc" },
        take: 20
      }),
      db.activityLog.findMany({
        where: {
          familyId,
          childId
        },
        include: {
          actor: {
            select: {
              displayName: true
            }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 30
      }),
      db.pointTransaction.findMany({
        where: { familyId, childId },
        include: {
          actor: {
            select: {
              displayName: true
            }
          }
        },
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
    child: toChildSummary(child),
    tasks: tasksWithAvailability,
    completions: completions.map((completion) => ({
      id: completion.id,
      completedAt: completion.completedAt,
      status: completion.status,
      task: {
        title: completion.task.title
      }
    })),
    rewards: rewardsWithProgress.map((reward) => ({
      id: reward.id,
      title: reward.title,
      description: reward.description,
      cost: reward.cost,
      iconEmoji: reward.iconEmoji,
      affordable: reward.affordable,
      progress: reward.progress
    })),
    rewardRequests: rewardRequests.map((request) => ({
      id: request.id,
      status: request.status,
      requestedAt: request.requestedAt,
      reward: {
        id: request.reward.id,
        title: request.reward.title,
        iconEmoji: request.reward.iconEmoji,
        cost: request.reward.cost
      }
    })),
    activity: activity.map((entry) => ({
      id: entry.id,
      message: entry.message,
      createdAt: entry.createdAt
    })),
    points,
    pointsHistory: pointsHistory.map((entry) => ({
      id: entry.id,
      amount: entry.amount,
      note: entry.note,
      createdAt: entry.createdAt,
      actor: entry.actor
        ? {
            displayName: entry.actor.displayName
          }
        : null
    })),
    badges: badgeList
  };
}
