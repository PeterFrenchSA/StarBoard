import { PointTransactionType, RedemptionStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiSessionMock = vi.hoisted(() => vi.fn());
const hasValidSameOriginMock = vi.hoisted(() => vi.fn());
const parseJsonBodyMock = vi.hoisted(() => vi.fn());
const createPointTransactionMock = vi.hoisted(() => vi.fn());
const getChildPointsMock = vi.hoisted(() => vi.fn());
const txMock = vi.hoisted(() => ({
  pointTransaction: {
    aggregate: vi.fn(),
    create: vi.fn()
  },
  rewardRedemption: {
    updateMany: vi.fn(),
    findUniqueOrThrow: vi.fn()
  },
  activityLog: {
    create: vi.fn()
  }
}));
const dbMock = vi.hoisted(() => ({
  rewardRedemption: {
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
  createPointTransaction: createPointTransactionMock,
  getChildPoints: getChildPointsMock
}));

vi.mock("@/lib/db", () => ({
  db: dbMock
}));

import { POST } from "./route";

describe("POST /api/parent/rewards/redemptions/:redemptionId/review", () => {
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
    parseJsonBodyMock.mockResolvedValue({ data: { decision: "APPROVE", note: "Enjoy" } });

    dbMock.rewardRedemption.findFirst.mockResolvedValue({
      id: "redemption_1",
      status: RedemptionStatus.REQUESTED,
      childId: "child_1",
      pointsCost: 50,
      child: { displayName: "Leia" },
      reward: { title: "Movie pick" }
    });

    dbMock.$transaction.mockImplementation(async (callback: (tx: typeof txMock) => Promise<unknown>) => callback(txMock));
    txMock.rewardRedemption.updateMany.mockResolvedValue({ count: 1 });
    txMock.rewardRedemption.findUniqueOrThrow.mockResolvedValue({
      id: "redemption_1",
      status: RedemptionStatus.APPROVED
    });
    txMock.activityLog.create.mockResolvedValue({ id: "activity_1" });
  });

  it("deducts points when redemption is approved", async () => {
    getChildPointsMock.mockResolvedValue(80);

    const response = await POST(
      new NextRequest("http://localhost/api/parent/rewards/redemptions/redemption_1/review", {
        method: "POST",
        body: JSON.stringify({})
      }),
      {
        params: Promise.resolve({ redemptionId: "redemption_1" })
      }
    );

    expect(response).toBeDefined();
    if (!response) {
      throw new Error("Expected a response");
    }

    expect(response.status).toBe(200);
    expect(createPointTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: PointTransactionType.REWARD_REDEMPTION,
        amount: -50,
        referenceId: "redemption_1"
      }),
      txMock
    );
  });

  it("rejects approval when child has insufficient points", async () => {
    getChildPointsMock.mockResolvedValue(10);

    const response = await POST(
      new NextRequest("http://localhost/api/parent/rewards/redemptions/redemption_1/review", {
        method: "POST",
        body: JSON.stringify({})
      }),
      {
        params: Promise.resolve({ redemptionId: "redemption_1" })
      }
    );

    expect(response).toBeDefined();
    if (!response) {
      throw new Error("Expected a response");
    }

    expect(response.status).toBe(409);
    expect(createPointTransactionMock).not.toHaveBeenCalled();
  });

  it("does not deduct points if a concurrent request already reviewed the redemption", async () => {
    getChildPointsMock.mockResolvedValue(80);
    txMock.rewardRedemption.updateMany.mockResolvedValue({ count: 0 });

    const response = await POST(
      new NextRequest("http://localhost/api/parent/rewards/redemptions/redemption_1/review", {
        method: "POST",
        body: JSON.stringify({})
      }),
      {
        params: Promise.resolve({ redemptionId: "redemption_1" })
      }
    );

    if (!response) {
      throw new Error("Expected a response");
    }

    expect(response.status).toBe(409);
    expect(createPointTransactionMock).not.toHaveBeenCalled();
  });
  it("does not overwrite a concurrent approval with a rejection", async () => {
    parseJsonBodyMock.mockResolvedValue({ data: { decision: "REJECT" } });
    dbMock.rewardRedemption.findFirst.mockResolvedValue({
      id: "item_1", status: "REQUESTED", childId: "child_1",
      reward: { title: "Movie" }, pointsCost: 10,
      child: { displayName: "Leia" }
    });
    txMock.rewardRedemption.updateMany.mockResolvedValue({ count: 0 });
    const response = await POST(new NextRequest("http://localhost/api/review", {
      method: "POST", body: "{}"
    }), { params: Promise.resolve({ redemptionId: "item_1" }) });
    expect(response?.status).toBe(409);
    expect(txMock.activityLog.create).not.toHaveBeenCalled();
    expect(createPointTransactionMock).not.toHaveBeenCalled();
  });
});
