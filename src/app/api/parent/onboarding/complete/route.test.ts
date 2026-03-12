import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiSessionMock = vi.hoisted(() => vi.fn());
const hasValidSameOriginMock = vi.hoisted(() => vi.fn());
const hashPasswordMock = vi.hoisted(() => vi.fn());

const txMock = vi.hoisted(() => ({
  family: { update: vi.fn() },
  user: { create: vi.fn(), update: vi.fn() },
  activityLog: { create: vi.fn() },
  task: { create: vi.fn() },
  reward: { create: vi.fn() }
}));

const dbMock = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn(),
    findMany: vi.fn()
  },
  $transaction: vi.fn()
}));

vi.mock("@/lib/auth/session", () => ({
  requireApiSession: requireApiSessionMock
}));

vi.mock("@/lib/csrf", () => ({
  hasValidSameOrigin: hasValidSameOriginMock
}));

vi.mock("@/lib/auth/password", () => ({
  hashPassword: hashPasswordMock
}));

vi.mock("@/lib/db", () => ({
  db: dbMock
}));

import { POST } from "./route";

describe("POST /api/parent/onboarding/complete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasValidSameOriginMock.mockReturnValue(true);
    hashPasswordMock.mockResolvedValue("hashed");
    dbMock.$transaction.mockImplementation(async (callback: (tx: typeof txMock) => Promise<unknown>) =>
      callback(txMock)
    );
    txMock.family.update.mockResolvedValue({});
    txMock.user.update.mockResolvedValue({});
    txMock.activityLog.create.mockResolvedValue({});
  });

  it("returns auth response when not authenticated", async () => {
    requireApiSessionMock.mockResolvedValue({
      response: Response.json({ error: "Unauthorized" }, { status: 401 })
    });

    const response = (await POST(
      new NextRequest("http://localhost/api/parent/onboarding/complete", {
        method: "POST",
        body: JSON.stringify({
          familyName: "My Family",
          themePreset: "sun",
          children: [],
          tasks: [],
          rewards: []
        })
      })
    )) as Response;

    expect(response.status).toBe(401);
  });

  it("completes onboarding for parent with basic setup", async () => {
    requireApiSessionMock.mockResolvedValue({
      session: {
        userId: "parent_1",
        familyId: "fam_1"
      }
    });

    dbMock.user.findFirst.mockResolvedValue({
      id: "parent_1",
      displayName: "Parent",
      onboardingCompletedAt: null
    });

    dbMock.user.findMany.mockResolvedValue([]);

    const response = (await POST(
      new NextRequest("http://localhost/api/parent/onboarding/complete", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          familyName: "My Family",
          themePreset: "sun",
          children: [],
          tasks: [],
          rewards: []
        })
      })
    )) as Response;

    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(txMock.family.update).toHaveBeenCalled();
    expect(txMock.user.update).toHaveBeenCalled();
    expect(payload.data.childrenCreated).toBe(0);
    expect(payload.data.tasksCreated).toBe(0);
    expect(payload.data.rewardsCreated).toBe(0);
  });
});
