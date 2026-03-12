import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiSessionMock = vi.hoisted(() => vi.fn());
const dbMock = vi.hoisted(() => ({
  family: { findMany: vi.fn() },
  supportTicket: { findMany: vi.fn() },
  user: { findMany: vi.fn() }
}));

vi.mock("@/lib/auth/session", () => ({
  requireApiSession: requireApiSessionMock
}));

vi.mock("@/lib/db", () => ({
  db: dbMock
}));

import { GET } from "./route";

describe("GET /api/provider/overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns auth response when user is not super admin", async () => {
    requireApiSessionMock.mockResolvedValue({
      response: Response.json({ error: "Forbidden" }, { status: 403 })
    });

    const response = await GET(new NextRequest("http://localhost/api/provider/overview"));
    expect(response.status).toBe(403);
  });

  it("returns provider stats and lists", async () => {
    requireApiSessionMock.mockResolvedValue({
      session: {
        userId: "admin_1"
      }
    });

    dbMock.family.findMany.mockResolvedValue([
      {
        id: "fam_1",
        name: "Skywalkers",
        billingInterval: "MONTHLY",
        subscriptionStatus: "ACTIVE",
        subscriptionCurrentPeriodEnd: null,
        stripeCustomerId: "cus_1",
        planBaseAmountCents: 500,
        includedChildren: 2,
        additionalChildAmountCents: 200,
        users: [
          { id: "p1", displayName: "Parent", role: "PARENT", email: "p@example.com" },
          { id: "c1", displayName: "Leia", role: "CHILD", email: "leia@example.com" },
          { id: "c2", displayName: "Will", role: "CHILD", email: "will@example.com" },
          { id: "c3", displayName: "Asha", role: "CHILD", email: "asha@example.com" }
        ],
        supportTickets: [{ id: "t1" }]
      }
    ]);

    dbMock.supportTicket.findMany.mockResolvedValue([]);
    dbMock.user.findMany.mockResolvedValue([
      { id: "admin_1", displayName: "Ops", email: "ops@example.com" }
    ]);

    const response = await GET(new NextRequest("http://localhost/api/provider/overview"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.stats.familiesCount).toBe(1);
    expect(payload.data.stats.activeSubscriptions).toBe(1);
    expect(payload.data.stats.featureRequestsCount).toBe(0);
    expect(payload.data.stats.estimatedMrrCents).toBe(700);
    expect(payload.data.supportAgents).toHaveLength(1);
  });
});
