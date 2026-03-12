import { ActivityType } from "@prisma/client";
import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { hasValidSameOrigin } from "@/lib/csrf";
import { db } from "@/lib/db";
import { parseJsonBody } from "@/lib/http";
import { updateVoiceTokenSchema } from "@/lib/validation/admin";

interface RouteContext {
  params: Promise<{ tokenId: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!hasValidSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const auth = await requireApiSession(request, ["PARENT"]);
  if (auth.response) {
    return auth.response;
  }

  const payload = await parseJsonBody(request, updateVoiceTokenSchema);
  if ("error" in payload) {
    return payload.error;
  }

  const { tokenId } = await context.params;

  const token = await db.voiceApiToken.findFirst({
    where: {
      id: tokenId,
      familyId: auth.session!.familyId,
      parentId: auth.session!.userId
    },
    select: {
      id: true,
      label: true,
      isActive: true
    }
  });

  if (!token) {
    return Response.json({ error: "Voice token not found" }, { status: 404 });
  }

  if (token.isActive === payload.data.isActive) {
    return Response.json({ data: token });
  }

  const updatedToken = await db.voiceApiToken.update({
    where: { id: token.id },
    data: {
      isActive: payload.data.isActive
    },
    select: {
      id: true,
      label: true,
      tokenPreview: true,
      isActive: true,
      createdAt: true,
      lastUsedAt: true,
      updatedAt: true
    }
  });

  await db.activityLog.create({
    data: {
      familyId: auth.session!.familyId,
      actorId: auth.session!.userId,
      type: payload.data.isActive ? ActivityType.VOICE_TOKEN_CREATED : ActivityType.VOICE_TOKEN_REVOKED,
      message: `${auth.session!.displayName} ${payload.data.isActive ? "re-activated" : "revoked"} voice token "${updatedToken.label}"`,
      metadata: {
        voiceTokenId: updatedToken.id,
        isActive: updatedToken.isActive
      }
    }
  });

  return Response.json({ data: updatedToken });
}
