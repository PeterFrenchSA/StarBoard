import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiSessionMock = vi.hoisted(() => vi.fn());
const hasValidSameOriginMock = vi.hoisted(() => vi.fn());
const parseJsonBodyMock = vi.hoisted(() => vi.fn());

const dbMock = vi.hoisted(() => ({
  childProfile: {
    upsert: vi.fn()
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

vi.mock("@/lib/db", () => ({
  db: dbMock
}));

import { POST } from "./route";

describe("POST /api/child/theme", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasValidSameOriginMock.mockReturnValue(true);
    requireApiSessionMock.mockResolvedValue({
      session: {
        familyId: "fam_1",
        userId: "child_1",
        displayName: "Leia"
      }
    });
    parseJsonBodyMock.mockResolvedValue({
      data: { theme: "dragons" }
    });
    dbMock.childProfile.upsert.mockResolvedValue({
      colorTheme: "dragons"
    });
  });

  it("rejects invalid request origin", async () => {
    hasValidSameOriginMock.mockReturnValue(false);

    const response = await POST(
      new NextRequest("http://localhost/api/child/theme", {
        method: "POST",
        body: JSON.stringify({ theme: "dragons" })
      })
    );

    if (!response) {
      throw new Error("Expected a response");
    }

    expect(response.status).toBe(403);
    const payload = await response.json();
    expect(payload.error).toContain("Invalid request origin");
  });

  it("updates the logged-in child theme", async () => {
    const response = await POST(
      new NextRequest("http://localhost/api/child/theme", {
        method: "POST",
        body: JSON.stringify({ theme: "dragons" })
      })
    );

    if (!response) {
      throw new Error("Expected a response");
    }

    expect(response.status).toBe(200);
    expect(dbMock.childProfile.upsert).toHaveBeenCalledWith({
      where: { userId: "child_1" },
      update: { colorTheme: "dragons" },
      create: { userId: "child_1", colorTheme: "dragons" },
      select: { colorTheme: true }
    });

    const payload = await response.json();
    expect(payload.data.colorTheme).toBe("dragons");
  });
});
