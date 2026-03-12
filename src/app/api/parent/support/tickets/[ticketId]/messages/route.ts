import { ActivityType, Role, SupportTicketStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { hasValidSameOrigin } from "@/lib/csrf";
import { db } from "@/lib/db";
import { parseJsonBody } from "@/lib/http";
import { createSupportTicketMessageSchema } from "@/lib/validation/support";

interface RouteContext {
  params: Promise<{ ticketId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
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

  const payload = await parseJsonBody(request, createSupportTicketMessageSchema);
  if ("error" in payload) {
    return payload.error;
  }

  const { ticketId } = await context.params;

  const ticket = await db.supportTicket.findFirst({
    where: {
      id: ticketId,
      familyId: auth.session!.familyId
    },
    select: {
      id: true,
      subject: true,
      status: true
    }
  });

  if (!ticket) {
    return Response.json({ error: "Support ticket not found" }, { status: 404 });
  }

  const updated = await db.$transaction(async (tx) => {
    const message = await tx.supportTicketMessage.create({
      data: {
        ticketId: ticket.id,
        authorId: parent.id,
        body: payload.data.body
      },
      include: {
        author: {
          select: {
            id: true,
            displayName: true,
            role: true
          }
        }
      }
    });

    await tx.supportTicket.update({
      where: { id: ticket.id },
      data: {
        lastMessageAt: message.createdAt,
        status:
          ticket.status === SupportTicketStatus.RESOLVED || ticket.status === SupportTicketStatus.CLOSED
            ? SupportTicketStatus.OPEN
            : ticket.status
      }
    });

    await tx.activityLog.create({
      data: {
        familyId: auth.session!.familyId,
        actorId: parent.id,
        type: ActivityType.SUPPORT_MESSAGE_CREATED,
        message: `${parent.displayName} replied to support ticket "${ticket.subject}"`,
        metadata: {
          ticketId: ticket.id,
          messageId: message.id
        }
      }
    });

    return message;
  });

  return Response.json({ data: updated }, { status: 201 });
}
