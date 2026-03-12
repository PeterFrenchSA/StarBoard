import { ActivityType } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { getStripeClient } from "@/lib/billing/stripe";
import { hasValidSameOrigin } from "@/lib/csrf";
import { db } from "@/lib/db";

function getAppUrl(request: NextRequest): string {
  const configured = process.env.APP_URL;
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  return request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  if (!hasValidSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const auth = await requireApiSession(request, ["PARENT"]);
  if (auth.response) {
    return auth.response;
  }

  const family = await db.family.findUnique({
    where: { id: auth.session!.familyId },
    select: {
      id: true,
      stripeCustomerId: true
    }
  });

  if (!family) {
    return Response.json({ error: "Family not found" }, { status: 404 });
  }

  if (!family.stripeCustomerId) {
    return Response.json({ error: "No Stripe customer found for this family yet" }, { status: 409 });
  }

  const stripe = getStripeClient();
  const looksLikeSeedPlaceholder = family.stripeCustomerId.startsWith("cus_seed_");

  if (looksLikeSeedPlaceholder) {
    return Response.json(
      {
        error:
          "Billing profile is not linked to a real Stripe customer yet. Start a billing checkout first."
      },
      { status: 409 }
    );
  }

  try {
    const customer = await stripe.customers.retrieve(family.stripeCustomerId);
    if ("deleted" in customer && customer.deleted) {
      await db.family.update({
        where: { id: family.id },
        data: {
          stripeCustomerId: null,
          billingUpdatedAt: new Date()
        }
      });

      return Response.json(
        {
          error:
            "Billing profile is outdated. Start a billing checkout to relink your Stripe customer."
        },
        { status: 409 }
      );
    }
  } catch {
    await db.family.update({
      where: { id: family.id },
      data: {
        stripeCustomerId: null,
        billingUpdatedAt: new Date()
      }
    });

    return Response.json(
      {
        error: "Billing profile is invalid. Start a billing checkout first, then open the portal."
      },
      { status: 409 }
    );
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: family.stripeCustomerId,
    return_url: `${getAppUrl(request)}/parent/billing?portal=return`
  });

  await db.activityLog.create({
    data: {
      familyId: family.id,
      actorId: auth.session!.userId,
      type: ActivityType.BILLING_PORTAL_OPENED,
      message: `${auth.session!.displayName} opened the billing portal`
    }
  });

  return Response.json({ data: { url: session.url } });
}
