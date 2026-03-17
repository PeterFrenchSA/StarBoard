import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  family: {
    findUniqueOrThrow: vi.fn()
  },
  user: {
    findMany: vi.fn(),
    findFirstOrThrow: vi.fn()
  },
  taskCompletion: {
    findMany: vi.fn()
  },
  rewardRedemption: {
    findMany: vi.fn()
  },
  task: {
    findMany: vi.fn()
  },
  reward: {
    findMany: vi.fn()
  },
  activityLog: {
    findMany: vi.fn()
  },
  supportTicket: {
    findMany: vi.fn(),
    count: vi.fn()
  },
  pointTransaction: {
    aggregate: vi.fn(),
    findMany: vi.fn()
  },
  taskTimerSession: {
    findMany: vi.fn()
  }
}));

const pricingMock = vi.hoisted(() => vi.fn());
const getChildPointsMock = vi.hoisted(() => vi.fn());
const getPointsByChildIdsMock = vi.hoisted(() => vi.fn());
const canTaskOccurTodayMock = vi.hoisted(() => vi.fn());
const getOccurrenceDateMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({
  db: dbMock
}));

vi.mock("@/lib/billing/pricing", () => ({
  calculateFamilyPlanPrice: pricingMock
}));

vi.mock("@/lib/points/service", () => ({
  getChildPoints: getChildPointsMock,
  getPointsByChildIds: getPointsByChildIdsMock
}));

vi.mock("@/lib/tasks/recurrence", () => ({
  canTaskOccurToday: canTaskOccurTodayMock,
  getOccurrenceDate: getOccurrenceDateMock
}));

import { getChildOverviewData, getParentOverviewData } from "@/lib/dashboard";

describe("dashboard serializers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sanitizes parent overview data before returning it to the client", async () => {
    const now = new Date("2026-03-17T08:00:00.000Z");

    dbMock.family.findUniqueOrThrow.mockResolvedValue({
      id: "fam_1",
      name: "StarBoard House",
      billingInterval: "MONTHLY",
      subscriptionStatus: "ACTIVE",
      billingEmail: "parent@starboard.local",
      stripeCustomerId: "cus_123",
      subscriptionCurrentPeriodEnd: now,
      subscriptionCancelAtPeriodEnd: false,
      planBaseAmountCents: 500,
      includedChildren: 2,
      additionalChildAmountCents: 200
    });

    dbMock.user.findMany
      .mockResolvedValueOnce([
        {
          id: "parent_1",
          displayName: "Parent",
          email: "parent@starboard.local",
          isFamilyOwner: true,
          createdAt: now
        }
      ])
      .mockResolvedValueOnce([
        {
          id: "child_1",
          displayName: "Leia",
          email: "leia@starboard.local",
          passwordHash: "secret",
          familyId: "fam_1",
          childProfile: {
            avatarEmoji: "🧚",
            colorTheme: "fairies",
            currentStreak: 3,
            longestStreak: 5
          }
        }
      ]);

    dbMock.taskCompletion.findMany.mockResolvedValue([
      {
        id: "completion_1",
        childId: "child_1",
        completedAt: now,
        task: {
          id: "task_1",
          title: "Make your bed",
          points: 5
        },
        child: {
          id: "child_1",
          displayName: "Leia",
          email: "leia@starboard.local",
          childProfile: {
            avatarEmoji: "🧚"
          }
        }
      }
    ]);

    dbMock.rewardRedemption.findMany.mockResolvedValue([]);
    dbMock.task.findMany.mockResolvedValue([
      {
        id: "task_1",
        assignedChildId: "child_1",
        title: "Make your bed",
        description: "Before school",
        points: 5,
        taskType: "ONE_OFF",
        recurrenceType: "NONE",
        weekdays: [],
        deadlineAt: null,
        timerDurationMinutes: null,
        requiresApproval: false,
        isActive: true,
        assignedChild: {
          id: "child_1",
          displayName: "Leia",
          passwordHash: "secret",
          childProfile: {
            avatarEmoji: "🧚"
          }
        }
      }
    ]);
    dbMock.reward.findMany.mockResolvedValue([]);
    dbMock.activityLog.findMany.mockResolvedValue([
      {
        id: "activity_1",
        type: "TASK_CREATED",
        message: "Parent created a task",
        createdAt: now,
        actor: {
          id: "parent_1",
          displayName: "Parent",
          email: "parent@starboard.local",
          role: "PARENT"
        },
        child: {
          id: "child_1",
          displayName: "Leia",
          email: "leia@starboard.local"
        }
      }
    ]);
    dbMock.supportTicket.findMany.mockResolvedValue([]);
    dbMock.supportTicket.count.mockResolvedValue(0);
    dbMock.pointTransaction.aggregate.mockResolvedValue({
      _sum: {
        amount: 20
      }
    });
    getPointsByChildIdsMock.mockResolvedValue({
      child_1: 42
    });
    pricingMock
      .mockReturnValueOnce({
        additionalChildren: 0,
        monthlyAmountCents: 500
      })
      .mockReturnValueOnce({
        billedAmountCents: 5000
      });

    const result = await getParentOverviewData("fam_1");

    expect(result.children[0]).not.toHaveProperty("passwordHash");
    expect(result.children[0]).not.toHaveProperty("familyId");
    expect(result.tasks[0].assignedChild).not.toHaveProperty("passwordHash");
    expect(result.pendingTaskApprovals[0].child).not.toHaveProperty("email");
    expect(result.activity[0].actor).toEqual({ displayName: "Parent" });
    expect(result.activity[0].child).toEqual({ displayName: "Leia" });
  });

  it("sanitizes child overview data before returning it to the client", async () => {
    const now = new Date("2026-03-17T08:00:00.000Z");

    dbMock.user.findFirstOrThrow.mockResolvedValue({
      id: "child_1",
      displayName: "Leia",
      email: "leia@starboard.local",
      passwordHash: "secret",
      familyId: "fam_1",
      childProfile: {
        avatarEmoji: "🧚",
        colorTheme: "fairies",
        currentStreak: 2,
        longestStreak: 4
      }
    });
    dbMock.task.findMany.mockResolvedValue([
      {
        id: "task_1",
        familyId: "fam_1",
        assignedChildId: "child_1",
        title: "Read for 20 minutes",
        description: "Read any book",
        points: 15,
        taskType: "RECURRING",
        recurrenceType: "DAILY",
        weekdays: [],
        deadlineAt: null,
        timerDurationMinutes: null,
        requiresApproval: true,
        isActive: true,
        createdAt: now
      }
    ]);
    dbMock.taskCompletion.findMany.mockResolvedValue([
      {
        id: "completion_1",
        taskId: "task_1",
        occurrenceDate: now,
        completedAt: now,
        status: "APPROVED",
        task: {
          id: "task_1",
          title: "Read for 20 minutes",
          taskType: "RECURRING"
        },
        reviewedBy: {
          id: "parent_1",
          displayName: "Parent",
          email: "parent@starboard.local",
          role: "PARENT"
        }
      }
    ]);
    dbMock.reward.findMany.mockResolvedValue([
      {
        id: "reward_1",
        title: "Extra screen time",
        description: "30 minutes",
        cost: 45,
        iconEmoji: "📺",
        isActive: true
      }
    ]);
    dbMock.rewardRedemption.findMany.mockResolvedValue([
      {
        id: "request_1",
        status: "REQUESTED",
        requestedAt: now,
        reward: {
          id: "reward_1",
          title: "Extra screen time",
          iconEmoji: "📺",
          cost: 45
        }
      }
    ]);
    dbMock.activityLog.findMany.mockResolvedValue([
      {
        id: "activity_1",
        message: "Leia completed a task",
        createdAt: now,
        actor: {
          displayName: "Parent",
          email: "parent@starboard.local"
        }
      }
    ]);
    dbMock.pointTransaction.findMany.mockResolvedValue([
      {
        id: "points_1",
        amount: 15,
        note: "Task reward",
        createdAt: now,
        actor: {
          displayName: "Parent",
          email: "parent@starboard.local"
        }
      }
    ]);
    dbMock.taskTimerSession.findMany.mockResolvedValue([]);
    getChildPointsMock.mockResolvedValue(55);
    getOccurrenceDateMock.mockReturnValue(now);
    canTaskOccurTodayMock.mockReturnValue(true);

    const result = await getChildOverviewData("fam_1", "child_1");

    expect(result.child).not.toHaveProperty("passwordHash");
    expect(result.child).not.toHaveProperty("familyId");
    expect(result.completions[0].task).toEqual({
      title: "Read for 20 minutes"
    });
    expect(result.activity[0]).not.toHaveProperty("actor");
    expect(result.pointsHistory[0].actor).toEqual({
      displayName: "Parent"
    });
    expect(result.rewardRequests[0].reward).toEqual({
      id: "reward_1",
      title: "Extra screen time",
      iconEmoji: "📺",
      cost: 45
    });
  });
});
