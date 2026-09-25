import { PointTransactionType, TaskCompletionStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiSessionMock = vi.hoisted(() => vi.fn());
const hasValidSameOriginMock = vi.hoisted(() => vi.fn());
const parseJsonBodyMock = vi.hoisted(() => vi.fn());
const createPointTransactionMock = vi.hoisted(() => vi.fn());
const updateChildStreakMock = vi.hoisted(() => vi.fn());
const txMock = vi.hoisted(() => ({
  taskCompletion: {
    updateMany: vi.fn(),
    findUniqueOrThrow: vi.fn()
  },
  pointTransaction: {
    create: vi.fn()
  },
  childProfile: {
    findUnique: vi.fn(),
    update: vi.fn()
  },
  activityLog: {
    create: vi.fn()
  }
}));
const dbMock = vi.hoisted(() => ({
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

vi.mock("@/lib/db", () => ({
  db: dbMock
}));

import { POST } from "./route";

describe("POST /api/parent/tasks/completions/:completionId/review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasValidSameOriginMock.mockReturnValue(true);
    requireApiSessionMock.mockResolvedValue({
      session: {
        familyId: "fam_1",
        userId: "parent_1",
        displayName: "Parent"
      }
    });
    dbMock.$transaction.mockImplementation(async (callback: (tx: typeof txMock) => Promise<unknown>) => callback(txMock));
    txMock.taskCompletion.updateMany.mockResolvedValue({ count: 1 });
    txMock.activityLog.create.mockResolvedValue({ id: "activity_1" });
  });

  it("awards points when completion is approved", async () => {
    parseJsonBodyMock.mockResolvedValue({ data: { decision: "APPROVE", note: "Great work" } });

    dbMock.taskCompletion.findFirst.mockResolvedValue({
      id: "completion_1",
      status: TaskCompletionStatus.PENDING_APPROVAL,
      childId: "child_1",
      task: {
        title: "Room tidy-up",
        points: 12
      },
      child: {
        displayName: "William"
      }
    });

    const completedAt = new Date("2026-03-10T08:00:00.000Z");
    txMock.taskCompletion.findUniqueOrThrow.mockResolvedValue({
      id: "completion_1",
      completedAt,
      status: TaskCompletionStatus.APPROVED
    });

    const response = await POST(
      new NextRequest("http://localhost/api/parent/tasks/completions/completion_1/review", {
        method: "POST",
        body: JSON.stringify({})
      }),
      {
        params: Promise.resolve({ completionId: "completion_1" })
      }
    );

    expect(response).toBeDefined();
    if (!response) {
      throw new Error("Expected a response");
    }

    expect(response.status).toBe(200);
    expect(createPointTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: PointTransactionType.TASK_REWARD,
        amount: 12,
        referenceId: "completion_1"
      }),
      txMock
    );
    expect(updateChildStreakMock).toHaveBeenCalledWith("child_1", completedAt, txMock);
  });

  it("does not award points if a concurrent request already reviewed the completion", async () => {
    parseJsonBodyMock.mockResolvedValue({ data: { decision: "APPROVE", note: "Great work" } });

    dbMock.taskCompletion.findFirst.mockResolvedValue({
      id: "completion_1",
      status: TaskCompletionStatus.PENDING_APPROVAL,
      childId: "child_1",
      task: {
        title: "Room tidy-up",
        points: 12
      },
      child: {
        displayName: "William"
      }
    });
    txMock.taskCompletion.updateMany.mockResolvedValue({ count: 0 });

    const response = await POST(
      new NextRequest("http://localhost/api/parent/tasks/completions/completion_1/review", {
        method: "POST",
        body: JSON.stringify({})
      }),
      {
        params: Promise.resolve({ completionId: "completion_1" })
      }
    );

    if (!response) {
      throw new Error("Expected a response");
    }

    expect(response.status).toBe(409);
    expect(createPointTransactionMock).not.toHaveBeenCalled();
    expect(updateChildStreakMock).not.toHaveBeenCalled();
  });
  it("does not overwrite a concurrent approval with a rejection", async () => {
    parseJsonBodyMock.mockResolvedValue({ data: { decision: "REJECT" } });
    dbMock.taskCompletion.findFirst.mockResolvedValue({
      id: "item_1", status: "PENDING_APPROVAL", childId: "child_1",
      task: { title: "Read", points: 10 },
      child: { displayName: "Leia" }
    });
    txMock.taskCompletion.updateMany.mockResolvedValue({ count: 0 });
    const response = await POST(new NextRequest("http://localhost/api/review", {
      method: "POST", body: "{}"
    }), { params: Promise.resolve({ completionId: "item_1" }) });
    expect(response?.status).toBe(409);
    expect(txMock.activityLog.create).not.toHaveBeenCalled();
    expect(createPointTransactionMock).not.toHaveBeenCalled();
  });
});
