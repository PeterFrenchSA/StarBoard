import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiSessionMock = vi.hoisted(() => vi.fn());
const getParentOverviewDataMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/session", () => ({
  requireApiSession: requireApiSessionMock
}));

vi.mock("@/lib/dashboard", () => ({
  getParentOverviewData: getParentOverviewDataMock
}));

import { GET } from "./route";

describe("GET /api/parent/overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns auth response when session is missing", async () => {
    requireApiSessionMock.mockResolvedValue({
      response: Response.json({ error: "Unauthorized" }, { status: 401 })
    });

    const response = await GET(new NextRequest("http://localhost/api/parent/overview"));

    expect(response.status).toBe(401);
  });

  it("returns overview data for authenticated parent", async () => {
    requireApiSessionMock.mockResolvedValue({
      session: {
        familyId: "fam_123"
      }
    });

    getParentOverviewDataMock.mockResolvedValue({
      stats: {
        childrenCount: 2
      }
    });

    const response = await GET(new NextRequest("http://localhost/api/parent/overview"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(getParentOverviewDataMock).toHaveBeenCalledWith("fam_123");
    expect(payload.data.stats.childrenCount).toBe(2);
  });
});
