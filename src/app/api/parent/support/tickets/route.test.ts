import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiSessionMock = vi.hoisted(() => vi.fn());
const hasValidSameOriginMock = vi.hoisted(() => vi.fn());

const txMock = vi.hoisted(() => ({
  supportTicket: { create: vi.fn() },
  supportTicketMessage: { create: vi.fn() },
  activityLog: { create: vi.fn() }
}));

const dbMock = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn()
  },
  supportTicket: {
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

vi.mock("@/lib/db", () => ({
  db: dbMock
}));

import { POST } from "./route";

describe("POST /api/parent/support/tickets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasValidSameOriginMock.mockReturnValue(true);
    dbMock.$transaction.mockImplementation(async (callback: (tx: typeof txMock) => Promise<unknown>) =>
      callback(txMock)
    );
  });

  it("returns auth response when not logged in", async () => {
    requireApiSessionMock.mockResolvedValue({
      response: Response.json({ error: "Unauthorized" }, { status: 401 })
    });

    const response = (await POST(
      new NextRequest("http://localhost/api/parent/support/tickets", {
        method: "POST",
        body: JSON.stringify({
          subject: "Billing help",
          description: "Need help with billing"
        })
      })
    )) as Response;

    expect(response.status).toBe(401);
  });

  it("creates support ticket and first message", async () => {
    requireApiSessionMock.mockResolvedValue({
      session: {
        userId: "parent_1",
        familyId: "fam_1"
      }
    });

    dbMock.user.findFirst.mockResolvedValue({
      id: "parent_1",
      displayName: "Parent"
    });

    txMock.supportTicket.create.mockResolvedValue({
      id: "ticket_1",
      subject: "Voice setup",
      priority: "NORMAL"
    });
    txMock.supportTicketMessage.create.mockResolvedValue({ id: "msg_1" });
    txMock.activityLog.create.mockResolvedValue({ id: "activity_1" });

    const response = (await POST(
      new NextRequest("http://localhost/api/parent/support/tickets", {
        method: "POST",
        body: JSON.stringify({
          subject: "Voice setup",
          description: "Google Home setup is not connecting.",
          priority: "NORMAL"
        }),
        headers: {
          "content-type": "application/json"
        }
      })
    )) as Response;

    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(txMock.supportTicket.create).toHaveBeenCalled();
    expect(txMock.supportTicketMessage.create).toHaveBeenCalled();
    expect(payload.data.id).toBe("ticket_1");
  });
});
