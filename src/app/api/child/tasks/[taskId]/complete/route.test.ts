import { TaskCompletionStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiSessionMock = vi.hoisted(() => vi.fn());
const hasValidSameOriginMock = vi.hoisted(() => vi.fn());
const parseJsonBodyMock = vi.hoisted(() => vi.fn());
const createPointTransactionMock = vi.hoisted(() => vi.fn());
const updateChildStreakMock = vi.hoisted(() => vi.fn());
const canTaskOccurTodayMock = vi.hoisted(() => vi.fn());
const getOccurrenceDateMock = vi.hoisted(() => vi.fn());

const txMock = vi.hoisted(() => ({
  taskCompletion: {
    create: vi.fn()
  },
  taskTimerSession: {
    update: vi.fn()
  }
}));

const dbMock = vi.hoisted(() => ({
  task: {
    findFirst: vi.fn()
  },
  taskTimerSession: {
    findUnique: vi.fn()
  },
  taskCompletion: {
    findFirst: vi.fn()
  },
  activityLog: {
    create: vi.fn()
  },
  $transaction: vi.fn()
}));

vi.mock("@/lib/auth/session", () => ({
  requireApiSession: requireApiSessionMock
}));

vi.mock("@/lib/csrf", () => ({
  hasValidSameOrigin: hasValidSameOriginMock
}));

vi.mock("@/lib/http", () => ({
  parseJsonBody: parseJsonBodyMock
}));

vi.mock("@/lib/points/service", () => ({
  createPointTransaction: createPointTransactionMock
}));

vi.mock("@/lib/tasks/streak", () => ({
  updateChildStreak: updateChildStreakMock
}));

vi.mock("@/lib/tasks/recurrence", () => ({
  canTaskOccurToday: canTaskOccurTodayMock,
  getOccurrenceDate: getOccurrenceDateMock
}));

vi.mock("@/lib/db", () => ({
  db: dbMock
}));

import { POST } from "./route";

const fixedOccurrence = new Date("2026-03-10T00:00:00.000Z");

describe("POST /api/child/tasks/[taskId]/complete", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    hasValidSameOriginMock.mockReturnValue(true);
    parseJsonBodyMock.mockResolvedValue({ data: {} });
    requireApiSessionMock.mockResolvedValue({
      session: {
        familyId: "fam_1",
        userId: "child_1",
        displayName: "Leia"
      }
    });

    canTaskOccurTodayMock.mockReturnValue(true);
    getOccurrenceDateMock.mockReturnValue(fixedOccurrence);
    dbMock.$transaction.mockImplementation(async (callback: (tx: typeof txMock) => Promise<unknown>) => callback(txMock));
    dbMock.activityLog.create.mockResolvedValue({ id: "activity_1" });
  });

  it("blocks completion when timer is required but not started", async () => {
    dbMock.task.findFirst.mockResolvedValue({
      id: "task_1",
      title: "Room tidy-up",
      familyId: "fam_1",
      assignedChildId: "child_1",
      isActive: true,
      taskType: "RECURRING",
      recurrenceType: "DAILY",
      weekdays: [],
      points: 10,
      requiresApproval: true,
      deadlineAt: null,
      timerDurationMinutes: 15
    });

    dbMock.taskTimerSession.findUnique.mockResolvedValue(null);

    const response = await POST(
      new NextRequest("http://localhost/api/child/tasks/task_1/complete", {
        method: "POST",
        body: JSON.stringify({})
      }),
      { params: Promise.resolve({ taskId: "task_1" }) }
    );

    if (!response) {
      throw new Error("Expected a response");
    }

    expect(response.status).toBe(409);
    const payload = await response.json();
    expect(payload.error).toContain("Start the task timer");
  });

  it("completes timer task when active timer exists", async () => {
    dbMock.task.findFirst.mockResolvedValue({
      id: "task_2",
      title: "Practice piano",
      familyId: "fam_1",
      assignedChildId: "child_1",
      isActive: true,
      taskType: "RECURRING",
      recurrenceType: "DAILY",
      weekdays: [],
      points: 20,
      requiresApproval: true,
      deadlineAt: null,
      timerDurationMinutes: 20
    });

    dbMock.taskTimerSession.findUnique.mockResolvedValue({
      id: "timer_1",
      taskId: "task_2",
      childId: "child_1",
      occurrenceDate: fixedOccurrence,
      startedAt: new Date("2026-03-10T10:00:00.000Z"),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      completedAt: null
    });

    dbMock.taskCompletion.findFirst.mockResolvedValue(null);

    txMock.taskCompletion.create.mockResolvedValue({
      id: "completion_1",
      taskId: "task_2",
      childId: "child_1",
      status: TaskCompletionStatus.PENDING_APPROVAL,
      completedAt: new Date()
    });
    txMock.taskTimerSession.update.mockResolvedValue({ id: "timer_1" });

    const response = await POST(
      new NextRequest("http://localhost/api/child/tasks/task_2/complete", {
        method: "POST",
        body: JSON.stringify({})
      }),
      { params: Promise.resolve({ taskId: "task_2" }) }
    );

    if (!response) {
      throw new Error("Expected a response");
    }

    expect(response.status).toBe(201);
    expect(txMock.taskTimerSession.update).toHaveBeenCalledWith({
      where: { id: "timer_1" },
      data: { completedAt: expect.any(Date) }
    });
  });
});
