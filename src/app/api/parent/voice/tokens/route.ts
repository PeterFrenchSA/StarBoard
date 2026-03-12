import { ActivityType, Role } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { hasValidSameOrigin } from "@/lib/csrf";
import { db } from "@/lib/db";
import { parseJsonBody } from "@/lib/http";
import { createVoiceTokenSchema } from "@/lib/validation/admin";
import { hashVoiceToken } from "@/lib/voice/token";

function buildTokenPreview(token: string): string {
  return `${token.slice(0, 8)}...`;
}

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, ["PARENT"]);
  if (auth.response) {
    return auth.response;
  }

  const tokens = await db.voiceApiToken.findMany({
    where: {
      familyId: auth.session!.familyId,
      parentId: auth.session!.userId
    },
    select: {
      id: true,
      label: true,
      tokenPreview: true,
      isActive: true,
      lastUsedAt: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  return Response.json({ data: tokens });
}

export async function POST(request: NextRequest) {
  if (!hasValidSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const auth = await requireApiSession(request, ["PARENT"]);
  if (auth.response) {
    return auth.response;
  }

  const parent = await db.user.findFirst({
    where: {
      id: auth.session!.userId,
      familyId: auth.session!.familyId,
      role: Role.PARENT,
      isActive: true
    },
    select: {
      id: true,
      displayName: true
    }
  });

  if (!parent) {
    return Response.json({ error: "Parent account not found" }, { status: 404 });
  }

  const payload = await parseJsonBody(request, createVoiceTokenSchema);
  if ("error" in payload) {
    return payload.error;
  }

  const plainToken = `sbv_${randomBytes(18).toString("hex")}`;
  const tokenHash = hashVoiceToken(plainToken);

  const voiceToken = await db.voiceApiToken.create({
    data: {
      familyId: auth.session!.familyId,
      label: payload.data.label,
      tokenHash,
      tokenPreview: buildTokenPreview(plainToken),
      createdById: parent.id,
      parentId: parent.id,
      isActive: true
    },
    select: {
      id: true,
      label: true,
      tokenPreview: true,
      isActive: true,
      createdAt: true
    }
  });

  await db.activityLog.create({
    data: {
      familyId: auth.session!.familyId,
      actorId: parent.id,
      type: ActivityType.VOICE_TOKEN_CREATED,
      message: `${parent.displayName} created voice token "${voiceToken.label}"`,
      metadata: {
        voiceTokenId: voiceToken.id
      }
    }
  });

  return Response.json(
    {
      data: {
        ...voiceToken,
        token: plainToken
      }
    },
    { status: 201 }
  );
}
