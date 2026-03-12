import { SubscriptionStatus, SupportTicketStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

const ACTIVE_SUBSCRIPTION_STATES = new Set<SubscriptionStatus>([
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIALING
]);

const OPEN_TICKET_STATES = new Set<SupportTicketStatus>([
  SupportTicketStatus.OPEN,
  SupportTicketStatus.IN_PROGRESS,
  SupportTicketStatus.WAITING_ON_PARENT
]);

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, ["SUPER_ADMIN"]);
  if (auth.response) {
    return auth.response;
  }

  const [families, tickets, supportAgents] = await Promise.all([
    db.family.findMany({
      include: {
        users: {
          where: {
            isActive: true
          },
          select: {
            id: true,
            displayName: true,
            role: true,
            email: true
          }
        },
        supportTickets: {
          where: {
            status: {
              in: [
                SupportTicketStatus.OPEN,
                SupportTicketStatus.IN_PROGRESS,
                SupportTicketStatus.WAITING_ON_PARENT
              ]
            }
          },
          select: {
            id: true
          }
        }
      },
      orderBy: {
        updatedAt: "desc"
      },
      take: 120
    }),
    db.supportTicket.findMany({
      include: {
        family: {
          select: {
            id: true,
            name: true
          }
        },
        createdBy: {
          select: {
            id: true,
            displayName: true,
            email: true
          }
        },
        assignedTo: {
          select: {
            id: true,
            displayName: true,
            email: true
          }
        },
        messages: {
          orderBy: {
            createdAt: "desc"
          },
          take: 6,
          include: {
            author: {
              select: {
                id: true,
                displayName: true,
                role: true
              }
            }
          }
        }
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 80
    }),
    db.user.findMany({
      where: {
        role: "SUPER_ADMIN",
        isSupportAgent: true,
        isActive: true
      },
      select: {
        id: true,
        displayName: true,
        email: true
      },
      orderBy: {
        displayName: "asc"
      }
    })
  ]);

  const familyRows = families.map((family) => {
    const parents = family.users.filter((user) => user.role === "PARENT");
    const children = family.users.filter((user) => user.role === "CHILD");

    return {
      id: family.id,
      name: family.name,
      billingInterval: family.billingInterval,
      subscriptionStatus: family.subscriptionStatus,
      subscriptionCurrentPeriodEnd: family.subscriptionCurrentPeriodEnd,
      stripeCustomerId: family.stripeCustomerId,
      planBaseAmountCents: family.planBaseAmountCents,
      includedChildren: family.includedChildren,
      additionalChildAmountCents: family.additionalChildAmountCents,
      parentCount: parents.length,
      childCount: children.length,
      openTicketCount: family.supportTickets.length,
      parents: parents.map((parent) => ({
        id: parent.id,
        displayName: parent.displayName,
        email: parent.email
      }))
    };
  });

  const openTicketsCount = tickets.filter((ticket) => OPEN_TICKET_STATES.has(ticket.status)).length;
  const featureRequestsCount = tickets.filter((ticket) => ticket.type === "FEATURE_REQUEST").length;
  const activeSubscriptions = familyRows.filter((family) =>
    ACTIVE_SUBSCRIPTION_STATES.has(family.subscriptionStatus)
  ).length;

  const estimatedMrrCents = familyRows.reduce((sum, family) => {
    if (!ACTIVE_SUBSCRIPTION_STATES.has(family.subscriptionStatus)) {
      return sum;
    }

    const additionalChildren = Math.max(0, family.childCount - family.includedChildren);
    const monthlyPrice = family.planBaseAmountCents + additionalChildren * family.additionalChildAmountCents;
    return sum + monthlyPrice;
  }, 0);

  return Response.json({
    data: {
      families: familyRows,
      tickets,
      supportAgents,
      stats: {
        familiesCount: familyRows.length,
        activeSubscriptions,
        openTicketsCount,
        featureRequestsCount,
        estimatedMrrCents
      }
    }
  });
}
