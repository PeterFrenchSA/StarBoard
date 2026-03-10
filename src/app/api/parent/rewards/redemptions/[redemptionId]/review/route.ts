import { ActivityType, PointTransactionType, RedemptionStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { hasValidSameOrigin } from "@/lib/csrf";
import { db } from "@/lib/db";
import { parseJsonBody } from "@/lib/http";
import { createPointTransaction, getChildPoints } from "@/lib/points/service";
import { reviewRedemptionSchema } from "@/lib/validation/parent";

interface RouteContext {
  params: Promise<{ redemptionId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!hasValidSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const auth = await requireApiSession(request, ["PARENT"]);
  if (auth.response) {
    return auth.response;
  }

  const payload = await parseJsonBody(request, reviewRedemptionSchema);
  if ("error" in payload) {
    return payload.error;
  }

  const { redemptionId } = await context.params;

  const redemption = await db.rewardRedemption.findFirst({
    where: {
      id: redemptionId,
      familyId: auth.session!.familyId
    },
    include: {
      child: true,
      reward: true
    }
  });

  if (!redemption) {
    return Response.json({ error: "Redemption not found" }, { status: 404 });
  }

  if (redemption.status !== RedemptionStatus.REQUESTED) {
    return Response.json({ error: "Redemption already reviewed" }, { status: 409 });
  }

  if (payload.data.decision === "APPROVE") {
    const currentPoints = await getChildPoints(auth.session!.familyId, redemption.childId);

    if (currentPoints < redemption.pointsCost) {
      return Response.json({ error: "Child does not have enough points" }, { status: 409 });
    }

    const updated = await db.rewardRedemption.update({
      where: { id: redemption.id },
      data: {
        status: RedemptionStatus.APPROVED,
        reviewedAt: new Date(),
        reviewedById: auth.session!.userId,
        note: payload.data.note
      }
    });

    await createPointTransaction({
      familyId: auth.session!.familyId,
      childId: redemption.childId,
      actorId: auth.session!.userId,
      type: PointTransactionType.REWARD_REDEMPTION,
      amount: -redemption.pointsCost,
      note: `Reward redeemed: ${redemption.reward.title}`,
      referenceType: "REWARD_REDEMPTION",
      referenceId: redemption.id
    });

    await db.activityLog.create({
      data: {
        familyId: auth.session!.familyId,
        actorId: auth.session!.userId,
        childId: redemption.childId,
        type: ActivityType.REWARD_APPROVED,
        message: `${auth.session!.displayName} approved reward "${redemption.reward.title}" for ${redemption.child.displayName}`,
        metadata: {
          redemptionId: redemption.id
        }
      }
    });

    return Response.json({ data: updated });
  }

  const updated = await db.rewardRedemption.update({
    where: { id: redemption.id },
    data: {
      status: RedemptionStatus.REJECTED,
      reviewedAt: new Date(),
      reviewedById: auth.session!.userId,
      note: payload.data.note
    }
  });

  await db.activityLog.create({
    data: {
      familyId: auth.session!.familyId,
      actorId: auth.session!.userId,
      childId: redemption.childId,
      type: ActivityType.REWARD_REJECTED,
      message: `${auth.session!.displayName} rejected reward "${redemption.reward.title}" for ${redemption.child.displayName}`,
      metadata: {
        redemptionId: redemption.id,
        note: payload.data.note
      }
    }
  });

  return Response.json({ data: updated });
}
