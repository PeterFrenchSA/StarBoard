import { createHash } from "node:crypto";
import { db } from "@/lib/db";

function getVoiceTokenSalt(): string {
  const salt = process.env.VOICE_TOKEN_SALT;

  if (!salt) {
    throw new Error("VOICE_TOKEN_SALT is not configured");
  }

  return salt;
}

export function hashVoiceToken(token: string): string {
  return createHash("sha256").update(`${getVoiceTokenSalt()}:${token}`).digest("hex");
}

export async function authenticateVoiceToken(plainToken: string | null | undefined) {
  if (!plainToken) {
    return null;
  }

  const tokenHash = hashVoiceToken(plainToken.trim());

  const voiceToken = await db.voiceApiToken.findUnique({
    where: { tokenHash },
    include: { family: true }
  });

  if (!voiceToken || !voiceToken.isActive) {
    return null;
  }

  await db.voiceApiToken.update({
    where: { id: voiceToken.id },
    data: { lastUsedAt: new Date() }
  });

  return voiceToken;
}

export function parseBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}
