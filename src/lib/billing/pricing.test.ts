import { BillingInterval } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { calculateFamilyPlanPrice } from "@/lib/billing/pricing";

describe("calculateFamilyPlanPrice", () => {
  it("applies base price when child count is within included threshold", () => {
    const result = calculateFamilyPlanPrice({
      childCount: 2,
      interval: BillingInterval.MONTHLY
    });

    expect(result.additionalChildren).toBe(0);
    expect(result.monthlyAmountCents).toBe(500);
    expect(result.billedAmountCents).toBe(500);
  });

  it("adds per-child surcharge and applies annual multiplier", () => {
    const result = calculateFamilyPlanPrice({
      childCount: 5,
      interval: BillingInterval.ANNUAL
    });

    // 5 children = 3 above included threshold -> 500 + (3 * 200) = 1100 monthly
    expect(result.additionalChildren).toBe(3);
    expect(result.monthlyAmountCents).toBe(1100);
    expect(result.billedAmountCents).toBe(11000);
  });
});
