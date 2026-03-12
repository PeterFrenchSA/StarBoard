import { SignJWT, jwtVerify } from "jose";
import { SESSION_TTL_SECONDS } from "@/lib/auth/constants";
import type { SessionPayload } from "@/lib/auth/types";

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error("AUTH_SECRET is not configured");
  }

  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({
    userId: payload.userId,
    familyId: payload.familyId,
    role: payload.role,
    email: payload.email,
    displayName: payload.displayName
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"]
    });

    if (
      typeof payload.userId !== "string" ||
      typeof payload.familyId !== "string" ||
      (payload.role !== "PARENT" && payload.role !== "CHILD" && payload.role !== "SUPER_ADMIN") ||
      typeof payload.email !== "string" ||
      typeof payload.displayName !== "string"
    ) {
      return null;
    }

    return {
      userId: payload.userId,
      familyId: payload.familyId,
      role: payload.role,
      email: payload.email,
      displayName: payload.displayName
    };
  } catch {
    return null;
  }
}
