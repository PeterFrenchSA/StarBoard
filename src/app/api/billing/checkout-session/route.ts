import { ActivityType } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { calculateFamilyPlanPrice } from "@/lib/billing/pricing";
import { getStripeClient, getStripeCurrency } from "@/lib/billing/stripe";
import { hasValidSameOrigin } from "@/lib/csrf";
import { db } from "@/lib/db";
import { parseJsonBody } from "@/lib/http";
import { createCheckoutSessionSchema } from "@/lib/validation/billing";

function getAppUrl(request: NextRequest): string {
  const configured = process.env.APP_URL;
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  return request.nextUrl.origin;
}

async function resolveStripeCustomerId(input: {
  existingCustomerId: string | null;
  familyId: string;
  familyName: string;
  billingEmail: string | null;
  actorEmail: string;
}) {
  const stripe = getStripeClient();

  const looksLikeSeedPlaceholder = input.existingCustomerId?.startsWith("cus_seed_");

  if (input.existingCustomerId && !looksLikeSeedPlaceholder) {
    try {
      const existingCustomer = await stripe.customers.retrieve(input.existingCustomerId);

      if (!("deleted" in existingCustomer && existingCustomer.deleted)) {
        return { customerId: existingCustomer.id, created: false };
      }
    } catch {
      // Fall back to creating a fresh customer below.
    }
  }

  const customer = await stripe.customers.create({
    email: input.billingEmail ?? input.actorEmail,
    name: input.familyName,
    metadata: {
      familyId: input.familyId
    }
  });

  await db.family.update({
    where: { id: input.familyId },
    data: {
      stripeCustomerId: customer.id,
      billingEmail: input.billingEmail ?? input.actorEmail,
      billingUpdatedAt: new Date()
    }
  });

  return { customerId: customer.id, created: true };
}

export async function POST(request: NextRequest) {
  if (!hasValidSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const auth = await requireApiSession(request, ["PARENT"]);
  if (auth.response) {
    return auth.response;
  }

  const payload = await parseJsonBody(request, createCheckoutSessionSchema);
  if ("error" in payload) {
    return payload.error;
  }

  const [family, childCount] = await Promise.all([
    db.family.findUnique({
      where: { id: auth.session!.familyId },
      select: {
        id: true,
        name: true,
        billingEmail: true,
        stripeCustomerId: true,
        planBaseAmountCents: true,
        includedChildren: true,
        additionalChildAmountCents: true
      }
    }),
    db.user.count({
      where: {
        familyId: auth.session!.familyId,
        role: "CHILD",
        isActive: true
      }
    })
  ]);

  if (!family) {
    return Response.json({ error: "Family not found" }, { status: 404 });
  }

  const pricing = calculateFamilyPlanPrice({
    childCount,
    interval: payload.data.interval,
    baseAmountCents: family.planBaseAmountCents,
    includedChildren: family.includedChildren,
    additionalChildAmountCents: family.additionalChildAmountCents
  });

  const appUrl = getAppUrl(request);
  const stripe = getStripeClient();
  const customer = await resolveStripeCustomerId({
    existingCustomerId: family.stripeCustomerId,
    familyId: family.id,
    familyName: family.name,
    billingEmail: family.billingEmail,
    actorEmail: auth.session!.email
  });

  const recurringInterval = payload.data.interval === "ANNUAL" ? "year" : "month";
  const lineItemDescription = `${pricing.childCount} child profile${pricing.childCount === 1 ? "" : "s"}, ${pricing.includedChildren} included`;

  let checkoutSession;
  try {
    checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customer.customerId,
      allow_promotion_codes: true,
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: getStripeCurrency(),
            unit_amount: pricing.billedAmountCents,
            recurring: {
              interval: recurringInterval
            },
            product_data: {
              name: "StarBoard Family Plan",
              description: lineItemDescription
            }
          }
        }
      ],
      metadata: {
        familyId: family.id,
        interval: payload.data.interval,
        childCount: String(pricing.childCount),
        monthlyAmountCents: String(pricing.monthlyAmountCents),
        billedAmountCents: String(pricing.billedAmountCents)
      },
      subscription_data: {
        metadata: {
          familyId: family.id,
          interval: payload.data.interval,
          childCount: String(pricing.childCount)
        }
      },
      success_url: `${appUrl}/parent/billing?checkout=success`,
      cancel_url: `${appUrl}/parent/billing?checkout=cancel`
    });
  } catch {
    return Response.json(
      { error: "Could not start Stripe checkout. Verify Stripe keys and try again." },
      { status: 502 }
    );
  }

  await db.$transaction([
    db.family.update({
      where: { id: family.id },
      data: {
        billingInterval: payload.data.interval,
        billingUpdatedAt: new Date()
      }
    }),
    db.activityLog.create({
      data: {
        familyId: family.id,
        actorId: auth.session!.userId,
        type: ActivityType.BILLING_CHECKOUT_STARTED,
        message: `${auth.session!.displayName} started ${payload.data.interval.toLowerCase()} billing checkout`,
        metadata: {
          interval: payload.data.interval,
          childCount: pricing.childCount,
          billedAmountCents: pricing.billedAmountCents,
          checkoutSessionId: checkoutSession.id,
          customerCreated: customer.created
        }
      }
    })
  ]);

  return Response.json({
    data: {
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
      pricing
    }
  });
}
