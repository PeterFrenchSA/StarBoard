import { ActivityType, RedemptionStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { hasValidSameOrigin } from "@/lib/csrf";
import { db } from "@/lib/db";
import { runSerializable } from "@/lib/transactions";
import { parseJsonBody } from "@/lib/http";
import { getChildPoints } from "@/lib/points/service";
import { requestRewardSchema } from "@/lib/validation/child";

interface RouteContext {
  params: Promise<{ rewardId: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!hasValidSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const auth = await requireApiSession(request, ["CHILD"]);
  if (auth.response) {
    return auth.response;
  }

  const payload = await parseJsonBody(request, requestRewardSchema);
  if ("error" in payload) {
    return payload.error;
  }

  const { rewardId } = await context.params;

  const reward = await db.reward.findFirst({
    where: {
      id: rewardId,
      familyId: auth.session!.familyId,
      isActive: true
    }
  });

  if (!reward) {
    return Response.json({ error: "Reward not found" }, { status: 404 });
  }

  const result = await runSerializable(async (tx) => {
    const existingRequest = await tx.rewardRedemption.findFirst({
      where: {
        familyId: auth.session!.familyId,
        rewardId,
        childId: auth.session!.userId,
        status: RedemptionStatus.REQUESTED
      }
    });

    if (existingRequest) {
      return { error: "Reward already requested and pending review" };
    }

    const points = await getChildPoints(auth.session!.familyId, auth.session!.userId, tx);

    if (points < reward.cost) {
      return { error: "Not enough points for this reward" };
    }

    const requestEntry = await tx.rewardRedemption.create({
      data: {
        familyId: auth.session!.familyId,
        rewardId: reward.id,
        childId: auth.session!.userId,
        pointsCost: reward.cost,
        note: payload.data.note
      }
    });

    await tx.activityLog.create({
      data: {
        familyId: auth.session!.familyId,
        actorId: auth.session!.userId,
        childId: auth.session!.userId,
        type: ActivityType.REWARD_REQUESTED,
        message: `${auth.session!.displayName} requested reward "${reward.title}"`,
        metadata: {
          rewardId: reward.id,
          redemptionId: requestEntry.id
        }
      }
    });

    return { requestEntry };
  });
  if (result.error) {
    return Response.json({ error: result.error }, { status: 409 });
  }
  return Response.json({ data: result.requestEntry }, { status: 201 });
}
