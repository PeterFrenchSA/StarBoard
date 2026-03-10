import { ActivityType } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { hasValidSameOrigin } from "@/lib/csrf";
import { db } from "@/lib/db";
import { parseJsonBody } from "@/lib/http";
import { updateRewardSchema } from "@/lib/validation/parent";

interface RouteContext {
  params: Promise<{ rewardId: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!hasValidSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const auth = await requireApiSession(request, ["PARENT"]);
  if (auth.response) {
    return auth.response;
  }

  const payload = await parseJsonBody(request, updateRewardSchema);
  if ("error" in payload) {
    return payload.error;
  }

  const { rewardId } = await context.params;

  const existingReward = await db.reward.findFirst({
    where: {
      id: rewardId,
      familyId: auth.session!.familyId
    }
  });

  if (!existingReward) {
    return Response.json({ error: "Reward not found" }, { status: 404 });
  }

  const updatedReward = await db.reward.update({
    where: { id: existingReward.id },
    data: {
      title: payload.data.title,
      description: payload.data.description,
      cost: payload.data.cost,
      iconEmoji: payload.data.iconEmoji,
      isActive: payload.data.isActive
    }
  });

  await db.activityLog.create({
    data: {
      familyId: auth.session!.familyId,
      actorId: auth.session!.userId,
      type: ActivityType.REWARD_CREATED,
      message: `${auth.session!.displayName} updated reward "${updatedReward.title}"`,
      metadata: {
        rewardId: updatedReward.id,
        cost: updatedReward.cost,
        isActive: updatedReward.isActive
      }
    }
  });

  return Response.json({ data: updatedReward });
}
