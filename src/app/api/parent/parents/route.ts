import { ActivityType, Role } from "@prisma/client";
import { NextRequest } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import { requireApiSession } from "@/lib/auth/session";
import { hasValidSameOrigin } from "@/lib/csrf";
import { db } from "@/lib/db";
import { parseJsonBody } from "@/lib/http";
import { createParentAccountSchema } from "@/lib/validation/admin";

export async function POST(request: NextRequest) {
  if (!hasValidSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const auth = await requireApiSession(request, ["PARENT"]);
  if (auth.response) {
    return auth.response;
  }

  const actor = await db.user.findFirst({
    where: {
      id: auth.session!.userId,
      familyId: auth.session!.familyId,
      role: Role.PARENT,
      isActive: true
    },
    select: {
      displayName: true,
      isFamilyOwner: true
    }
  });

  if (!actor?.isFamilyOwner) {
    return Response.json({ error: "Only the family owner can add additional parents" }, { status: 403 });
  }

  const payload = await parseJsonBody(request, createParentAccountSchema);
  if ("error" in payload) {
    return payload.error;
  }

  const email = payload.data.email.toLowerCase();
  const existing = await db.user.findUnique({ where: { email } });

  if (existing) {
    return Response.json({ error: "Email already in use" }, { status: 409 });
  }

  const passwordHash = await hashPassword(payload.data.password);

  const parent = await db.user.create({
    data: {
      familyId: auth.session!.familyId,
      role: Role.PARENT,
      email,
      passwordHash,
      displayName: payload.data.parentName,
      isFamilyOwner: false,
      onboardingCompletedAt: new Date()
    },
    select: {
      id: true,
      displayName: true,
      email: true,
      createdAt: true
    }
  });

  await db.activityLog.create({
    data: {
      familyId: auth.session!.familyId,
      actorId: auth.session!.userId,
      type: ActivityType.PARENT_ADDED,
      message: `${actor.displayName} added parent account for ${parent.displayName}`,
      metadata: {
        parentId: parent.id,
        parentEmail: parent.email
      }
    }
  });

  return Response.json({ data: parent }, { status: 201 });
}
