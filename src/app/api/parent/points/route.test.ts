import { PointTransactionType } from "@prisma/client";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiSessionMock = vi.hoisted(() => vi.fn());
const hasValidSameOriginMock = vi.hoisted(() => vi.fn());
const parseJsonBodyMock = vi.hoisted(() => vi.fn());
const createPointTransactionMock = vi.hoisted(() => vi.fn());
const dbMock = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn()
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

vi.mock("@/lib/db", () => ({
  db: dbMock
}));

import { POST } from "./route";

describe("POST /api/parent/points", () => {
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
    dbMock.user.findFirst.mockResolvedValue({
      id: "child_1",
      displayName: "Leia"
    });
    dbMock.activityLog.create.mockResolvedValue({ id: "activity_1" });
  });

  it("creates MANUAL_ADD transaction for positive amount", async () => {
    parseJsonBodyMock.mockResolvedValue({
      data: {
        childId: "child_1",
        amount: 10,
        note: "Great routine"
      }
    });
    createPointTransactionMock.mockResolvedValue({ id: "txn_1" });

    const response = await POST(
      new NextRequest("http://localhost/api/parent/points", {
        method: "POST",
        body: JSON.stringify({})
      })
    );

    expect(response).toBeDefined();
    if (!response) {
      throw new Error("Expected a response");
    }

    expect(response.status).toBe(201);
    expect(createPointTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: PointTransactionType.MANUAL_ADD,
        amount: 10
      })
    );
  });

  it("creates MANUAL_REMOVE transaction for negative amount", async () => {
    parseJsonBodyMock.mockResolvedValue({
      data: {
        childId: "child_1",
        amount: -6,
        note: "Missed bedtime"
      }
    });
    createPointTransactionMock.mockResolvedValue({ id: "txn_2" });

    const response = await POST(
      new NextRequest("http://localhost/api/parent/points", {
        method: "POST",
        body: JSON.stringify({})
      })
    );

    expect(response).toBeDefined();
    if (!response) {
      throw new Error("Expected a response");
    }

    expect(response.status).toBe(201);
    expect(createPointTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: PointTransactionType.MANUAL_REMOVE,
        amount: -6
      })
    );
  });
});
