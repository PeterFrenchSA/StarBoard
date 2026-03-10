import { ActivityType, PointTransactionType, Prisma, Role } from "@prisma/client";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { parseJsonBody } from "@/lib/http";
import { createPointTransaction, getChildPoints } from "@/lib/points/service";
import { getRequestIdentity, rateLimit } from "@/lib/rate-limit";
import { voiceAddPointsSchema } from "@/lib/validation/voice";
import { authenticateVoiceToken, parseBearerToken } from "@/lib/voice/token";

export async function POST(request: NextRequest) {
  const bearer = parseBearerToken(request.headers.get("authorization"));
  const voiceToken = await authenticateVoiceToken(bearer);

  if (!voiceToken) {
    return Response.json({ error: "Unauthorized voice token" }, { status: 401 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const limiterKey = getRequestIdentity(ip, `voice-add-points-${voiceToken.id}`);
  const limit = rateLimit(limiterKey, 60, 60 * 1000);

  if (!limit.allowed) {
    return Response.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const payload = await parseJsonBody(request, voiceAddPointsSchema);
  if ("error" in payload) {
    return payload.error;
  }

  const childWhere: Prisma.UserWhereInput = {
    familyId: voiceToken.familyId,
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
    return Response.json({ error: "Child not found" }, { status: 404 });
  }

  const transaction = await createPointTransaction({
    familyId: voiceToken.familyId,
    childId: child.id,
    actorId: null,
    type: PointTransactionType.VOICE_ADJUSTMENT,
    amount: payload.data.amount,
    note: payload.data.note,
    referenceType: "VOICE",
    referenceId: voiceToken.id
  });

  await db.activityLog.create({
    data: {
      familyId: voiceToken.familyId,
      childId: child.id,
      type: ActivityType.VOICE_POINTS_ADDED,
      message: `Voice action adjusted ${child.displayName}'s points by ${payload.data.amount}`,
      metadata: {
        note: payload.data.note,
        voiceTokenLabel: voiceToken.label
      }
    }
  });

  const points = await getChildPoints(voiceToken.familyId, child.id);

  return Response.json({
    data: {
      transaction,
      child: {
        id: child.id,
        displayName: child.displayName,
        points
      }
    }
  });
}
