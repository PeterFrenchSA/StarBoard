import { ActivityType, PointTransactionType, Prisma, Role } from "@prisma/client";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { createPointTransaction, getChildPoints } from "@/lib/points/service";
import { voiceAddPointsSchema } from "@/lib/validation/voice";
import { requireVoiceAuth, voiceError, voiceOk } from "@/lib/voice/http";

export async function POST(request: NextRequest) {
  const auth = await requireVoiceAuth(request, { scope: "add-points" });
  if (auth.response) {
    return auth.response;
  }

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    return voiceError("Invalid JSON payload", 400);
  }

  const payload = voiceAddPointsSchema.safeParse(requestBody);
  if (!payload.success) {
    return voiceError(payload.error.issues[0]?.message ?? "Validation failed", 422);
  }

  const childWhere: Prisma.UserWhereInput = {
    familyId: auth.token!.familyId,
    role: Role.CHILD,
    isActive: true
  };

  if (payload.data.childId) {
    childWhere.id = payload.data.childId;
  } else if (payload.data.childName) {
    childWhere.displayName = {
      equals: payload.data.childName,
      mode: "insensitive"
    };
  }

  const child = await db.user.findFirst({ where: childWhere });

  if (!child) {
    return voiceError("Child not found", 404);
  }

  const transaction = await createPointTransaction({
    familyId: auth.token!.familyId,
    childId: child.id,
    actorId: null,
    type: PointTransactionType.VOICE_ADJUSTMENT,
    amount: payload.data.amount,
    note: payload.data.note,
    referenceType: "VOICE",
    referenceId: auth.token!.id
  });

  await db.activityLog.create({
    data: {
      familyId: auth.token!.familyId,
      childId: child.id,
      type: ActivityType.VOICE_POINTS_ADDED,
      message: `Voice action adjusted ${child.displayName}'s points by ${payload.data.amount}`,
      metadata: {
        note: payload.data.note,
        voiceTokenLabel: auth.token!.label
      }
    }
  });

  const points = await getChildPoints(auth.token!.familyId, child.id);

  return voiceOk({
    transaction,
    child: {
      id: child.id,
      displayName: child.displayName,
      points
    }
  });
}
