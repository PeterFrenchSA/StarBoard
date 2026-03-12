import { ActivityType, Role, SupportTicketStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { hasValidSameOrigin } from "@/lib/csrf";
import { db } from "@/lib/db";
import { parseJsonBody } from "@/lib/http";
import { updateSupportTicketSchema } from "@/lib/validation/support";

interface RouteContext {
  params: Promise<{ ticketId: string }>;
}

function shouldSetResolvedAt(status: SupportTicketStatus | undefined): Date | null | undefined {
  if (!status) {
    return undefined;
  }

  if (status === SupportTicketStatus.RESOLVED || status === SupportTicketStatus.CLOSED) {
    return new Date();
  }

  return null;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!hasValidSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const auth = await requireApiSession(request, ["SUPER_ADMIN"]);
  if (auth.response) {
    return auth.response;
  }

  const payload = await parseJsonBody(request, updateSupportTicketSchema);
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

  if (typeof payload.data.assignedToId !== "undefined" && payload.data.assignedToId !== null) {
    const supportAgent = await db.user.findFirst({
      where: {
        id: payload.data.assignedToId,
        role: Role.SUPER_ADMIN,
        isSupportAgent: true,
        isActive: true
      },
      select: {
        id: true
      }
    });

    if (!supportAgent) {
      return Response.json({ error: "Assigned user must be an active support agent" }, { status: 422 });
    }
  }

  const updated = await db.supportTicket.update({
    where: { id: ticket.id },
    data: {
      status: payload.data.status,
      priority: payload.data.priority,
      assignedToId: payload.data.assignedToId,
      resolvedAt: shouldSetResolvedAt(payload.data.status)
    },
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
      }
    }
  });

  await db.activityLog.create({
    data: {
      familyId: ticket.familyId,
      actorId: auth.session!.userId,
      type: ActivityType.SUPPORT_TICKET_UPDATED,
      message: `${auth.session!.displayName} updated support ticket "${ticket.subject}"`,
      metadata: {
        ticketId: ticket.id,
        status: updated.status,
        priority: updated.priority,
        assignedToId: updated.assignedToId
      }
    }
  });

  return Response.json({ data: updated });
}
