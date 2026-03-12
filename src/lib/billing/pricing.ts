import { BillingInterval } from "@prisma/client";

export interface FamilyPlanPricingInput {
  childCount: number;
  interval: BillingInterval;
  baseAmountCents?: number;
  includedChildren?: number;
  additionalChildAmountCents?: number;
}

export interface FamilyPlanPricingBreakdown {
  childCount: number;
  additionalChildren: number;
  includedChildren: number;
  interval: BillingInterval;
  monthlyAmountCents: number;
  billedAmountCents: number;
  baseAmountCents: number;
  additionalChildAmountCents: number;
}

const DEFAULT_BASE_AMOUNT_CENTS = 500;
const DEFAULT_INCLUDED_CHILDREN = 2;
const DEFAULT_ADDITIONAL_CHILD_AMOUNT_CENTS = 200;

export function calculateFamilyPlanPrice(input: FamilyPlanPricingInput): FamilyPlanPricingBreakdown {
  const childCount = Math.max(0, Math.floor(input.childCount));
  const includedChildren = Math.max(0, input.includedChildren ?? DEFAULT_INCLUDED_CHILDREN);
  const baseAmountCents = Math.max(0, input.baseAmountCents ?? DEFAULT_BASE_AMOUNT_CENTS);
  const additionalChildAmountCents = Math.max(
    0,
    input.additionalChildAmountCents ?? DEFAULT_ADDITIONAL_CHILD_AMOUNT_CENTS
  );

  const additionalChildren = Math.max(0, childCount - includedChildren);
  const monthlyAmountCents = baseAmountCents + additionalChildren * additionalChildAmountCents;
  const billedAmountCents = input.interval === BillingInterval.ANNUAL ? monthlyAmountCents * 10 : monthlyAmountCents;

  return {
    childCount,
    additionalChildren,
    includedChildren,
    interval: input.interval,
    monthlyAmountCents,
    billedAmountCents,
    baseAmountCents,
    additionalChildAmountCents
  };
}

export function centsToCurrencyString(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2
  }).format(cents / 100);
}
