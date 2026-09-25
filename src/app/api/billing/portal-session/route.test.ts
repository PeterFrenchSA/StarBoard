import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getStripe = vi.hoisted(() => vi.fn());
const update = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ requireApiSession: async () => ({ session: { familyId: "family", userId: "parent" } }) }));
vi.mock("@/lib/csrf", () => ({ hasValidSameOrigin: () => true }));
vi.mock("@/lib/billing/stripe", () => ({ getStripeClient: getStripe }));
vi.mock("@/lib/db", () => ({ db: { family: {
  findUnique: async () => ({ id: "family", stripeCustomerId: "cus_existing" }), update
} } }));
import { POST } from "./route";

describe("billing portal failures", () => {
  beforeEach(() => vi.resetAllMocks());

  it("preserves the customer link when Stripe times out", async () => {
    getStripe.mockReturnValue({ customers: { retrieve: vi.fn().mockRejectedValue(new Error("Timeout")) } });
    const response = await POST(new NextRequest("http://localhost/api/billing/portal-session", { method: "POST" }));
    expect(response?.status).toBe(502);
    expect(update).not.toHaveBeenCalled();
  });

  it("returns JSON when billing is not configured", async () => {
    getStripe.mockImplementation(() => { throw new Error("Missing key"); });
    const response = await POST(new NextRequest("http://localhost/api/billing/portal-session", { method: "POST" }));
    expect(response?.status).toBe(503);
    expect(response?.headers.get("content-type")).toContain("application/json");
  });
});
