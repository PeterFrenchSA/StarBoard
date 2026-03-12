import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/auth/constants";
import { createSessionToken, verifySessionToken } from "@/lib/auth/jwt";
import { db } from "@/lib/db";
import type { SessionPayload, SessionRole } from "@/lib/auth/types";

export { createSessionToken, verifySessionToken };

function getDefaultRolePath(role: SessionRole): "/parent" | "/child" | "/provider" {
  if (role === "SUPER_ADMIN") {
    return "/provider";
  }

  return role === "PARENT" ? "/parent" : "/child";
}

export function applySessionCookie(response: NextResponse, token: string): void {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
}

async function validateSession(session: SessionPayload | null): Promise<SessionPayload | null> {
  if (!session) {
    return null;
  }

  const user = await db.user.findFirst({
    where: {
      id: session.userId,
      familyId: session.familyId,
      role: session.role,
      isActive: true
    },
    select: {
      id: true
    }
  });

  return user ? session : null;
}

export async function getServerSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const session = await verifySessionToken(token);
  return validateSession(session);
}

export async function requireServerSession(roles?: SessionRole[]): Promise<SessionPayload> {
  const session = await getServerSession();

  if (!session) {
    redirect("/login");
  }

  if (roles && !roles.includes(session.role)) {
    redirect(getDefaultRolePath(session.role) as never);
  }

  return session;
}

export async function getApiSession(request: NextRequest): Promise<SessionPayload | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const session = await verifySessionToken(token);
  return validateSession(session);
}

export async function requireApiSession(
  request: NextRequest,
  roles?: SessionRole[]
): Promise<{ session?: SessionPayload; response?: NextResponse }> {
  const session = await getApiSession(request);

  if (!session) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  if (roles && !roles.includes(session.role)) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { session };
}
