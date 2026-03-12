import { SubscriptionStatus } from "@prisma/client";
import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripeCurrency(): string {
  return (process.env.STRIPE_PRICE_CURRENCY ?? "usd").toLowerCase();
}

export function getStripeClient(): Stripe {
  if (stripeClient) {
    return stripeClient;
  }

  const apiKey = process.env.STRIPE_SECRET_KEY;

  if (!apiKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  stripeClient = new Stripe(apiKey);

  return stripeClient;
}

export function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }

  return secret;
}

export function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "active":
      return SubscriptionStatus.ACTIVE;
    case "trialing":
      return SubscriptionStatus.TRIALING;
    case "past_due":
      return SubscriptionStatus.PAST_DUE;
    case "canceled":
      return SubscriptionStatus.CANCELED;
    case "incomplete":
    case "incomplete_expired":
      return SubscriptionStatus.INCOMPLETE;
    case "unpaid":
      return SubscriptionStatus.UNPAID;
    case "paused":
      return SubscriptionStatus.PAST_DUE;
    default:
      return SubscriptionStatus.INACTIVE;
  }
}
