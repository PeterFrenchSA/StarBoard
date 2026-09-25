import { Role } from "@prisma/client";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hashPasswordMock = vi.hoisted(() => vi.fn());
const requireApiSessionMock = vi.hoisted(() => vi.fn());
const hasValidSameOriginMock = vi.hoisted(() => vi.fn());
const parseJsonBodyMock = vi.hoisted(() => vi.fn());
const dbMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  user: {
    findUnique: vi.fn(),
    create: vi.fn()
  },
  activityLog: {
    create: vi.fn()
  }
}));

vi.mock("@/lib/auth/password", () => ({
  hashPassword: hashPasswordMock
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

describe("POST /api/parent/children", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.$transaction.mockImplementation(async (work: (tx: typeof dbMock) => Promise<unknown>) => work(dbMock));
    hasValidSameOriginMock.mockReturnValue(true);
    requireApiSessionMock.mockResolvedValue({
      session: {
        familyId: "fam_1",
        userId: "parent_1",
        displayName: "Parent"
      }
    });
    parseJsonBodyMock.mockResolvedValue({
      data: {
        childName: "Leia",
        email: "Leia@StarBoard.local",
        password: "StarKid123!",
        avatarEmoji: "⭐"
      }
    });
    dbMock.user.findUnique.mockResolvedValue(null);
    hashPasswordMock.mockResolvedValue("hashed-password");
    dbMock.activityLog.create.mockResolvedValue({ id: "activity_1" });
  });

  it("creates a child account without returning password hash fields", async () => {
    dbMock.user.create.mockResolvedValue({
      id: "child_1",
      email: "leia@starboard.local",
      displayName: "Leia",
      role: Role.CHILD,
      createdAt: new Date("2026-03-10T08:00:00.000Z"),
      childProfile: {
        avatarEmoji: "⭐",
        colorTheme: "fairies",
        currentStreak: 0,
        longestStreak: 0
      }
    });

    const response = await POST(
      new NextRequest("http://localhost/api/parent/children", {
        method: "POST",
        body: JSON.stringify({})
      })
    );

    if (!response) {
      throw new Error("Expected a response");
    }

    expect(response.status).toBe(201);
    expect(dbMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.not.objectContaining({
          passwordHash: true
        })
      })
    );

    const body = await response.json();
    expect(body.data).not.toHaveProperty("passwordHash");
    expect(body.data.childProfile).not.toHaveProperty("userId");
  });
});
