import { ActivityType, SupportTicketStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { hasValidSameOrigin } from "@/lib/csrf";
import { db } from "@/lib/db";
import { parseJsonBody } from "@/lib/http";
import { createProviderSupportTicketMessageSchema } from "@/lib/validation/support";

interface RouteContext {
  params: Promise<{ ticketId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!hasValidSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const auth = await requireApiSession(request, ["SUPER_ADMIN"]);
  if (auth.response) {
    return auth.response;
  }

  const payload = await parseJsonBody(request, createProviderSupportTicketMessageSchema);
  if ("error" in payload) {
    return payload.error;
  }

  const { ticketId } = await context.params;

  const ticket = await db.supportTicket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      familyId: true,
      subject: true
    }
  });

  if (!ticket) {
    return Response.json({ error: "Support ticket not found" }, { status: 404 });
  }

  const message = await db.$transaction(async (tx) => {
    const createdMessage = await tx.supportTicketMessage.create({
      data: {
        ticketId: ticket.id,
        authorId: auth.session!.userId,
        body: payload.data.body,
        isInternal: payload.data.isInternal
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
        lastMessageAt: createdMessage.createdAt,
        status: payload.data.isInternal ? SupportTicketStatus.IN_PROGRESS : SupportTicketStatus.WAITING_ON_PARENT
      }
    });

    await tx.activityLog.create({
      data: {
        familyId: ticket.familyId,
        actorId: auth.session!.userId,
        type: ActivityType.SUPPORT_MESSAGE_CREATED,
        message: `${auth.session!.displayName} replied to support ticket "${ticket.subject}"`,
        metadata: {
          ticketId: ticket.id,
          messageId: createdMessage.id,
          isInternal: payload.data.isInternal
        }
      }
    });

    return createdMessage;
  });

  return Response.json({ data: message }, { status: 201 });
}
