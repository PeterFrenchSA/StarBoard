import { ActivityType } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth/password";
import { applySessionCookie, createSessionToken } from "@/lib/auth/session";
import { hasValidSameOrigin } from "@/lib/csrf";
import { db } from "@/lib/db";
import { parseJsonBody } from "@/lib/http";
import { getRequestIdentity, rateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation/auth";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const limit = rateLimit(getRequestIdentity(ip, "auth-login"), 25, 10 * 60 * 1000);

  if (!limit.allowed) {
    return Response.json(
      { error: "Too many login attempts. Try again soon." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  if (!hasValidSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const payload = await parseJsonBody(request, loginSchema);

  if ("error" in payload) {
    return payload.error;
  }

  const { email, password } = payload.data;

  const user = await db.user.findUnique({
    where: { email: email.toLowerCase() }
  });

  if (!user || !user.isActive) {
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.passwordHash);

  if (!valid) {
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await createSessionToken({
    userId: user.id,
    familyId: user.familyId,
    role: user.role,
    email: user.email,
    displayName: user.displayName
  });

  await db.activityLog.create({
    data: {
      familyId: user.familyId,
      actorId: user.id,
      childId: user.role === "CHILD" ? user.id : null,
      type: ActivityType.LOGIN,
      message: `${user.displayName} logged in`
    }
  });

  const response = NextResponse.json({
    data: {
      id: user.id,
      role: user.role,
      displayName: user.displayName
    }
  });

  applySessionCookie(response, token);

  return response;
}
