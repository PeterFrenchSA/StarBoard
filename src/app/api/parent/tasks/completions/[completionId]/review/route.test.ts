import { PointTransactionType, TaskCompletionStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiSessionMock = vi.hoisted(() => vi.fn());
const hasValidSameOriginMock = vi.hoisted(() => vi.fn());
const parseJsonBodyMock = vi.hoisted(() => vi.fn());
const createPointTransactionMock = vi.hoisted(() => vi.fn());
const updateChildStreakMock = vi.hoisted(() => vi.fn());
const dbMock = vi.hoisted(() => ({
  taskCompletion: {
    findFirst: vi.fn(),
    update: vi.fn()
  },
  activityLog: {
    create: vi.fn()
  }
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
    dbMock.activityLog.create.mockResolvedValue({ id: "activity_1" });
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
    dbMock.taskCompletion.update.mockResolvedValue({
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
      })
    );
    expect(updateChildStreakMock).toHaveBeenCalledWith("child_1", completedAt);
  });
});
