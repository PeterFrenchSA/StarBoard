import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE } from "@/lib/auth/constants";

const verify = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/jwt", () => ({ verifySessionToken: verify }));
import { proxy } from "./proxy";

describe("page routing", () => {
  beforeEach(() => vi.resetAllMocks());

  it("lets the login page validate a signed but potentially stale session", async () => {
    verify.mockResolvedValue({ role: "PARENT", userId: "deleted_user" });
    const response = await proxy(new NextRequest("http://localhost/login", {
      headers: { cookie: `${SESSION_COOKIE}=signed-token` }
    }));
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("redirects a child away from the parent dashboard", async () => {
    verify.mockResolvedValue({ role: "CHILD" });
    const response = await proxy(new NextRequest("http://localhost/parent", {
      headers: { cookie: `${SESSION_COOKIE}=signed-token` }
    }));
    expect(response.headers.get("location")).toBe("http://localhost/child");
  });
});
