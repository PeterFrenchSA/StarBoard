import { ActivityType, PointTransactionType, RedemptionStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { hasValidSameOrigin } from "@/lib/csrf";
import { db } from "@/lib/db";
import { runSerializable } from "@/lib/transactions";
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

  const approve = payload.data.decision === "APPROVE";
  const result = await runSerializable(async (tx) => {
    if (approve) {
      const currentPoints = await getChildPoints(auth.session!.familyId, redemption.childId, tx);
      if (currentPoints < redemption.pointsCost) {
        return { error: "Child does not have enough points" };
      }
    }
    const claimed = await tx.rewardRedemption.updateMany({
      where: {
        id: redemption.id,
        familyId: auth.session!.familyId,
        status: RedemptionStatus.REQUESTED
      },
      data: {
        status: approve ? RedemptionStatus.APPROVED : RedemptionStatus.REJECTED,
        reviewedAt: new Date(),
        reviewedById: auth.session!.userId,
        note: payload.data.note
      }
    });
    if (claimed.count !== 1) {
      return { error: "Redemption already reviewed" };
    }
    const updated = await tx.rewardRedemption.findUniqueOrThrow({ where: { id: redemption.id } });
    if (approve) {
      await createPointTransaction({
        familyId: auth.session!.familyId,
        childId: redemption.childId,
        actorId: auth.session!.userId,
        type: PointTransactionType.REWARD_REDEMPTION,
        amount: -redemption.pointsCost,
        note: `Reward redeemed: ${redemption.reward.title}`,
        referenceType: "REWARD_REDEMPTION",
        referenceId: redemption.id
      }, tx);
    }
    await tx.activityLog.create({
      data: {
        familyId: auth.session!.familyId,
        actorId: auth.session!.userId,
        childId: redemption.childId,
        type: approve ? ActivityType.REWARD_APPROVED : ActivityType.REWARD_REJECTED,
        message: `${auth.session!.displayName} ${approve ? "approved" : "rejected"} reward "${redemption.reward.title}" for ${redemption.child.displayName}`,
        metadata: { redemptionId: redemption.id, note: payload.data.note }
      }
    });
    return { redemption: updated };
  });

  if (result.error) {
    return Response.json({ error: result.error }, { status: 409 });
  }
  return Response.json({ data: result.redemption });
}
