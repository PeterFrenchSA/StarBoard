import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireVoiceAuthMock = vi.hoisted(() => vi.fn());
const dbMock = vi.hoisted(() => ({
  user: { findFirst: vi.fn() },
  activityLog: { create: vi.fn() }
}));
const createPointTransactionMock = vi.hoisted(() => vi.fn());
const getChildPointsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/voice/http", async () => {
  const actual = await vi.importActual<typeof import("@/lib/voice/http")>("@/lib/voice/http");
  return {
    ...actual,
    requireVoiceAuth: requireVoiceAuthMock
  };
});

vi.mock("@/lib/db", () => ({
  db: dbMock
}));

vi.mock("@/lib/points/service", () => ({
  createPointTransaction: createPointTransactionMock,
  getChildPoints: getChildPointsMock
}));

import { POST } from "./route";

describe("POST /api/voice/add-points", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when voice token authentication fails", async () => {
    requireVoiceAuthMock.mockResolvedValue({
      response: Response.json(
        {
          ok: false,
          error: "Unauthorized voice token",
          timestamp: new Date("2026-03-10T08:00:00.000Z").toISOString()
        },
        { status: 401 }
      )
    });

    const response = await POST(
      new NextRequest("http://localhost/api/voice/add-points", {
        method: "POST",
        body: JSON.stringify({
          childName: "Leia",
          amount: 10,
          note: "Great focus"
        })
      })
    );

    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.ok).toBe(false);
    expect(payload.error).toBe("Unauthorized voice token");
  });
});
