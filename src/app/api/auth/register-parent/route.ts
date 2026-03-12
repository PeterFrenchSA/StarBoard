import { ActivityType, Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, applySessionCookie } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { hasValidSameOrigin } from "@/lib/csrf";
import { db } from "@/lib/db";
import { parseJsonBody } from "@/lib/http";
import { getRequestIdentity, rateLimit } from "@/lib/rate-limit";
import { registerParentSchema } from "@/lib/validation/auth";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const limit = rateLimit(getRequestIdentity(ip, "auth-register"), 10, 10 * 60 * 1000);

  if (!limit.allowed) {
    return Response.json(
      { error: "Too many attempts. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  if (!hasValidSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const payload = await parseJsonBody(request, registerParentSchema);

  if ("error" in payload) {
    return payload.error;
  }

  const { familyName, parentName, email, password } = payload.data;

  const existing = await db.user.findUnique({
    where: { email: email.toLowerCase() }
  });

  if (existing) {
    return Response.json({ error: "Email already registered" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  const result = await db.$transaction(async (tx) => {
    const family = await tx.family.create({
      data: {
        name: familyName
      }
    });

    const parent = await tx.user.create({
      data: {
        familyId: family.id,
        role: Role.PARENT,
        email: email.toLowerCase(),
        passwordHash,
        displayName: parentName,
        isFamilyOwner: true
      }
    });

    await tx.activityLog.createMany({
      data: [
        {
          familyId: family.id,
          actorId: parent.id,
          type: ActivityType.FAMILY_CREATED,
          message: `${parentName} created family ${familyName}`
        },
        {
          familyId: family.id,
          actorId: parent.id,
          type: ActivityType.USER_CREATED,
          message: `Parent account created for ${parentName}`
        }
      ]
    });

    return { family, parent };
  });

  const token = await createSessionToken({
    userId: result.parent.id,
    familyId: result.family.id,
    role: Role.PARENT,
    email: result.parent.email,
    displayName: result.parent.displayName
  });

  const response = NextResponse.json(
    {
      data: {
        id: result.parent.id,
        role: result.parent.role,
        displayName: result.parent.displayName
      }
    },
    { status: 201 }
  );

  applySessionCookie(response, token);
  return response;
}
