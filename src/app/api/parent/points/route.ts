import { ActivityType, PointTransactionType, Role } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { hasValidSameOrigin } from "@/lib/csrf";
import { db } from "@/lib/db";
import { parseJsonBody } from "@/lib/http";
import { createPointTransaction } from "@/lib/points/service";
import { adjustPointsSchema } from "@/lib/validation/parent";

export async function POST(request: NextRequest) {
  if (!hasValidSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const auth = await requireApiSession(request, ["PARENT"]);
  if (auth.response) {
    return auth.response;
  }

  const payload = await parseJsonBody(request, adjustPointsSchema);
  if ("error" in payload) {
    return payload.error;
  }

  const child = await db.user.findFirst({
    where: {
      id: payload.data.childId,
      familyId: auth.session!.familyId,
      role: Role.CHILD,
      isActive: true
    }
  });

  if (!child) {
    return Response.json({ error: "Child not found" }, { status: 404 });
  }

  const transaction = await createPointTransaction({
    familyId: auth.session!.familyId,
    childId: payload.data.childId,
    actorId: auth.session!.userId,
    type: payload.data.amount > 0 ? PointTransactionType.MANUAL_ADD : PointTransactionType.MANUAL_REMOVE,
    amount: payload.data.amount,
    note: payload.data.note,
    referenceType: "MANUAL"
  });

  await db.activityLog.create({
    data: {
      familyId: auth.session!.familyId,
      actorId: auth.session!.userId,
      childId: child.id,
      type: ActivityType.POINTS_ADJUSTED,
      message: `${auth.session!.displayName} adjusted ${child.displayName}'s points by ${payload.data.amount}`,
      metadata: {
        note: payload.data.note,
        transactionId: transaction.id
      }
    }
  });

  return Response.json({ data: transaction }, { status: 201 });
}
