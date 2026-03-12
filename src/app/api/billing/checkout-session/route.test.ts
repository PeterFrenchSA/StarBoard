import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireApiSessionMock = vi.hoisted(() => vi.fn());
const hasValidSameOriginMock = vi.hoisted(() => vi.fn());
const getStripeClientMock = vi.hoisted(() => vi.fn());
const getStripeCurrencyMock = vi.hoisted(() => vi.fn());

const dbMock = vi.hoisted(() => ({
  family: {
    findUnique: vi.fn(),
    update: vi.fn()
  },
  user: {
    count: vi.fn()
  },
  activityLog: {
    create: vi.fn()
  },
  $transaction: vi.fn()
}));

vi.mock("@/lib/auth/session", () => ({
  requireApiSession: requireApiSessionMock
}));

vi.mock("@/lib/csrf", () => ({
  hasValidSameOrigin: hasValidSameOriginMock
}));

vi.mock("@/lib/billing/stripe", () => ({
  getStripeClient: getStripeClientMock,
  getStripeCurrency: getStripeCurrencyMock
}));

vi.mock("@/lib/db", () => ({
  db: dbMock
}));

import { POST } from "./route";

describe("POST /api/billing/checkout-session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasValidSameOriginMock.mockReturnValue(true);
    getStripeCurrencyMock.mockReturnValue("usd");
    dbMock.family.update.mockResolvedValue({});
    dbMock.activityLog.create.mockResolvedValue({});
    dbMock.$transaction.mockResolvedValue([]);
  });

  it("returns auth response when session is missing", async () => {
    requireApiSessionMock.mockResolvedValue({
      response: Response.json({ error: "Unauthorized" }, { status: 401 })
    });

    const response = (await POST(
      new NextRequest("http://localhost/api/billing/checkout-session", {
        method: "POST",
        body: JSON.stringify({ interval: "MONTHLY" })
      })
    )) as Response;

    expect(response.status).toBe(401);
  });

  it("creates checkout session with computed family pricing", async () => {
    requireApiSessionMock.mockResolvedValue({
      session: {
        userId: "parent_1",
        familyId: "fam_1",
        email: "parent@example.com",
        displayName: "Parent"
      }
    });

    dbMock.family.findUnique.mockResolvedValue({
      id: "fam_1",
      name: "The Family",
      billingEmail: "parent@example.com",
      stripeCustomerId: "cus_123",
      planBaseAmountCents: 500,
      includedChildren: 2,
      additionalChildAmountCents: 200
    });

    dbMock.user.count.mockResolvedValue(4);

    const checkoutCreateMock = vi.fn().mockResolvedValue({
      id: "cs_123",
      url: "https://checkout.stripe.test/session"
    });

    getStripeClientMock.mockReturnValue({
      customers: {
        retrieve: vi.fn().mockResolvedValue({
          id: "cus_123",
          deleted: false
        }),
        create: vi.fn()
      },
      checkout: {
        sessions: {
          create: checkoutCreateMock
        }
      }
    });

    const response = (await POST(
      new NextRequest("http://localhost/api/billing/checkout-session", {
        method: "POST",
        body: JSON.stringify({ interval: "MONTHLY" }),
        headers: {
          "content-type": "application/json"
        }
      })
    )) as Response;

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(checkoutCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({
              unit_amount: 900
            })
          })
        ]
      })
    );
    expect(payload.data.url).toBe("https://checkout.stripe.test/session");
  });
});
