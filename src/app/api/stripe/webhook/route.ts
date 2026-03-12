import { ActivityType, BillingInterval, type Prisma, SubscriptionStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import Stripe from "stripe";
import { getStripeClient, getStripeWebhookSecret, mapStripeSubscriptionStatus } from "@/lib/billing/stripe";
import { db } from "@/lib/db";

function getIntervalFromStripe(
  value: Stripe.Price.Recurring.Interval | null | undefined
): BillingInterval {
  return value === "year" ? BillingInterval.ANNUAL : BillingInterval.MONTHLY;
}

async function resolveFamilyByCustomerOrSubscription(input: {
  customerId?: string | null;
  subscriptionId?: string | null;
}) {
  if (!input.customerId && !input.subscriptionId) {
    return null;
  }

  return db.family.findFirst({
    where: {
      OR: [
        ...(input.subscriptionId ? [{ stripeSubscriptionId: input.subscriptionId }] : []),
        ...(input.customerId ? [{ stripeCustomerId: input.customerId }] : [])
      ]
    },
    select: { id: true }
  });
}

async function writeBillingActivity(
  familyId: string,
  message: string,
  metadata?: Prisma.InputJsonValue
) {
  await db.activityLog.create({
    data: {
      familyId,
      actorId: null,
      type: ActivityType.BILLING_UPDATED,
      message,
      metadata
    }
  });
}

async function handleSubscriptionEvent(subscription: Stripe.Subscription): Promise<string | null> {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;

  const familyId =
    subscription.metadata.familyId ??
    (
      await resolveFamilyByCustomerOrSubscription({
        customerId,
        subscriptionId: subscription.id
      })
    )?.id ??
    null;

  if (!familyId) {
    return null;
  }

  await db.family.update({
    where: { id: familyId },
    data: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: subscription.items.data[0]?.price?.id,
      subscriptionStatus: mapStripeSubscriptionStatus(subscription.status),
      billingInterval: getIntervalFromStripe(subscription.items.data[0]?.price?.recurring?.interval),
      subscriptionCurrentPeriodEnd: subscription.items.data[0]?.current_period_end
        ? new Date(subscription.items.data[0].current_period_end * 1000)
        : null,
      subscriptionCancelAtPeriodEnd: subscription.cancel_at_period_end,
      billingUpdatedAt: new Date()
    }
  });

  await writeBillingActivity(familyId, `Stripe subscription ${subscription.status.replace(/_/g, " ")}`, {
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: customerId ?? null
  });

  return familyId;
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<string | null> {
  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

  const familyId =
    session.metadata?.familyId ??
    (
      await resolveFamilyByCustomerOrSubscription({
        customerId,
        subscriptionId
      })
    )?.id ??
    null;

  if (!familyId) {
    return null;
  }

  await db.family.update({
    where: { id: familyId },
    data: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      billingUpdatedAt: new Date()
    }
  });

  await writeBillingActivity(familyId, "Stripe checkout completed", {
    checkoutSessionId: session.id,
    stripeCustomerId: customerId ?? null,
    stripeSubscriptionId: subscriptionId ?? null
  });

  return familyId;
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<string | null> {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  const subscription = invoice.parent?.subscription_details?.subscription;
  const subscriptionId = typeof subscription === "string" ? subscription : subscription?.id;

  const family = await resolveFamilyByCustomerOrSubscription({
    customerId,
    subscriptionId
  });

  if (!family) {
    return null;
  }

  await db.family.update({
    where: { id: family.id },
    data: {
      subscriptionStatus: SubscriptionStatus.PAST_DUE,
      billingUpdatedAt: new Date()
    }
  });

  await writeBillingActivity(family.id, "Stripe invoice payment failed", {
    stripeInvoiceId: invoice.id,
    stripeSubscriptionId: subscriptionId ?? null
  });

  return family.id;
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return Response.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const payload = await request.text();
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(payload, signature, getStripeWebhookSecret());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid webhook payload";
    return Response.json({ error: message }, { status: 400 });
  }

  const existing = await db.billingEvent.findUnique({
    where: { stripeEventId: event.id },
    select: { id: true }
  });

  if (existing) {
    return Response.json({ data: { received: true, duplicate: true } });
  }

  let familyId: string | null = null;

  switch (event.type) {
    case "checkout.session.completed": {
      familyId = await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      familyId = await handleSubscriptionEvent(event.data.object as Stripe.Subscription);
      break;
    }
    case "invoice.payment_failed": {
      familyId = await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
      break;
    }
    default:
      break;
  }

  if (familyId) {
    await db.billingEvent.create({
      data: {
        familyId,
        stripeEventId: event.id,
        eventType: event.type,
        payload: event as unknown as object,
        processedAt: new Date()
      }
    });
  }

  return Response.json({ data: { received: true } });
}
