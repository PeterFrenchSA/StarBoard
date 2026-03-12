import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiSessionMock = vi.hoisted(() => vi.fn());
const dbMock = vi.hoisted(() => ({
  supportTicket: {
    findMany: vi.fn()
  }
}));

vi.mock("@/lib/auth/session", () => ({
  requireApiSession: requireApiSessionMock
}));

vi.mock("@/lib/db", () => ({
  db: dbMock
}));

import { GET } from "./route";

describe("GET /api/provider/feature-requests/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns auth response when not super admin", async () => {
    requireApiSessionMock.mockResolvedValue({
      response: Response.json({ error: "Forbidden" }, { status: 403 })
    });

    const response = await GET(new NextRequest("http://localhost/api/provider/feature-requests/export"));
    expect(response.status).toBe(403);
  });

  it("returns CSV export for feature requests", async () => {
    requireApiSessionMock.mockResolvedValue({
      session: {
        userId: "admin_1"
      }
    });

    dbMock.supportTicket.findMany.mockResolvedValue([
      {
        id: "ticket_1",
        family: { name: "Skywalkers" },
        subject: "Need Apple Watch widget",
        description: "Would love quick actions from watch.",
        status: "OPEN",
        priority: "HIGH",
        category: "mobile",
        createdBy: { displayName: "Parent", email: "parent@example.com" },
        assignedTo: null,
        createdAt: new Date("2026-03-12T09:00:00.000Z"),
        updatedAt: new Date("2026-03-12T10:00:00.000Z"),
        resolvedAt: null
      }
    ]);

    const response = await GET(new NextRequest("http://localhost/api/provider/feature-requests/export"));
    const csv = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(csv).toContain("ticket_id,family_name,subject");
    expect(csv).toContain("Need Apple Watch widget");
  });
});
