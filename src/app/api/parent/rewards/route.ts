import { ActivityType } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { hasValidSameOrigin } from "@/lib/csrf";
import { db } from "@/lib/db";
import { parseJsonBody } from "@/lib/http";
import { createRewardSchema } from "@/lib/validation/parent";

export async function POST(request: NextRequest) {
  if (!hasValidSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const auth = await requireApiSession(request, ["PARENT"]);
  if (auth.response) {
    return auth.response;
  }

  const payload = await parseJsonBody(request, createRewardSchema);
  if ("error" in payload) {
    return payload.error;
  }

  const reward = await db.reward.create({
    data: {
      familyId: auth.session!.familyId,
      createdById: auth.session!.userId,
      title: payload.data.title,
      description: payload.data.description,
      cost: payload.data.cost,
      iconEmoji: payload.data.iconEmoji
    }
  });

  await db.activityLog.create({
    data: {
      familyId: auth.session!.familyId,
      actorId: auth.session!.userId,
      type: ActivityType.REWARD_CREATED,
      message: `${auth.session!.displayName} created reward "${reward.title}"`,
      metadata: {
        rewardId: reward.id,
        cost: reward.cost
      }
    }
  });

  return Response.json({ data: reward }, { status: 201 });
}
