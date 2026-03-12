import { ActivityType, Role, SupportTicketStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { hasValidSameOrigin } from "@/lib/csrf";
import { db } from "@/lib/db";
import { parseJsonBody } from "@/lib/http";
import { createSupportTicketSchema } from "@/lib/validation/support";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, ["PARENT"]);
  if (auth.response) {
    return auth.response;
  }

  const tickets = await db.supportTicket.findMany({
    where: {
      familyId: auth.session!.familyId
    },
    include: {
      createdBy: {
        select: {
          id: true,
          displayName: true
        }
      },
      assignedTo: {
        select: {
          id: true,
          displayName: true
        }
      },
      messages: {
        where: {
          isInternal: false
        },
        orderBy: { createdAt: "asc" },
        include: {
          author: {
            select: {
              id: true,
              displayName: true,
              role: true
            }
          }
        },
        take: 20
      }
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take: 40
  });

  return Response.json({ data: tickets });
}

export async function POST(request: NextRequest) {
  if (!hasValidSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const auth = await requireApiSession(request, ["PARENT"]);
  if (auth.response) {
    return auth.response;
  }

  const parent = await db.user.findFirst({
    where: {
      id: auth.session!.userId,
      familyId: auth.session!.familyId,
      role: Role.PARENT,
      isActive: true
    },
    select: {
      id: true,
      displayName: true
    }
  });

  if (!parent) {
    return Response.json({ error: "Parent account not found" }, { status: 404 });
  }

  const payload = await parseJsonBody(request, createSupportTicketSchema);
  if ("error" in payload) {
    return payload.error;
  }

  const ticket = await db.$transaction(async (tx) => {
    const createdTicket = await tx.supportTicket.create({
      data: {
        familyId: auth.session!.familyId,
        createdById: parent.id,
        subject: payload.data.subject,
        description: payload.data.description,
        type: payload.data.type,
        priority: payload.data.priority,
        category: payload.data.category,
        status: SupportTicketStatus.OPEN,
        lastMessageAt: new Date()
      }
    });

    await tx.supportTicketMessage.create({
      data: {
        ticketId: createdTicket.id,
        authorId: parent.id,
        body: payload.data.description
      }
    });

    await tx.activityLog.create({
      data: {
        familyId: auth.session!.familyId,
        actorId: parent.id,
        type: ActivityType.SUPPORT_TICKET_CREATED,
        message: `${parent.displayName} opened ${createdTicket.type === "FEATURE_REQUEST" ? "feature request" : "support ticket"} "${createdTicket.subject}"`,
        metadata: {
          ticketId: createdTicket.id,
          priority: createdTicket.priority,
          ticketType: createdTicket.type
        }
      }
    });

    return createdTicket;
  });

  return Response.json({ data: ticket }, { status: 201 });
}
