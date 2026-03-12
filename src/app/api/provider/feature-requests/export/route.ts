import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

function csvEscape(value: string | null | undefined): string {
  const input = value ?? "";
  const escaped = input.replace(/"/g, '""');
  return `"${escaped}"`;
}

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, ["SUPER_ADMIN"]);
  if (auth.response) {
    return auth.response;
  }

  const tickets = await db.supportTicket.findMany({
    where: {
      type: "FEATURE_REQUEST"
    },
    include: {
      family: {
        select: {
          name: true
        }
      },
      createdBy: {
        select: {
          displayName: true,
          email: true
        }
      },
      assignedTo: {
        select: {
          displayName: true,
          email: true
        }
      }
    },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }]
  });

  const header = [
    "ticket_id",
    "family_name",
    "subject",
    "description",
    "status",
    "priority",
    "category",
    "created_by",
    "created_by_email",
    "assigned_to",
    "assigned_to_email",
    "created_at",
    "updated_at",
    "resolved_at"
  ];

  const lines = tickets.map((ticket) =>
    [
      ticket.id,
      ticket.family.name,
      ticket.subject,
      ticket.description,
      ticket.status,
      ticket.priority,
      ticket.category,
      ticket.createdBy.displayName,
      ticket.createdBy.email,
      ticket.assignedTo?.displayName ?? "",
      ticket.assignedTo?.email ?? "",
      ticket.createdAt.toISOString(),
      ticket.updatedAt.toISOString(),
      ticket.resolvedAt?.toISOString() ?? ""
    ]
      .map((value) => csvEscape(value))
      .join(",")
  );

  const csv = [header.join(","), ...lines].join("\n");
  const date = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=starboard-feature-requests-${date}.csv`
    }
  });
}
