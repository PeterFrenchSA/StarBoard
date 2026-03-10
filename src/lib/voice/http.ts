import type { Family, VoiceApiToken } from "@prisma/client";
import type { NextRequest } from "next/server";
import { getRequestIdentity, rateLimit } from "@/lib/rate-limit";
import { authenticateVoiceToken, parseBearerToken } from "@/lib/voice/token";

type VoiceTokenWithFamily = VoiceApiToken & { family: Family };

export function voiceError(message: string, status: number, headers?: HeadersInit): Response {
  return Response.json(
    {
      ok: false,
      error: message,
      timestamp: new Date().toISOString()
    },
    {
      status,
      headers
    }
  );
}

export function voiceOk<T>(data: T, status = 200): Response {
  return Response.json(
    {
      ok: true,
      data,
      timestamp: new Date().toISOString()
    },
    { status }
  );
}

interface VoiceAuthOptions {
  scope: string;
  maxRequests?: number;
  windowMs?: number;
}

export async function requireVoiceAuth(
  request: NextRequest,
  options: VoiceAuthOptions
): Promise<{ token?: VoiceTokenWithFamily; response?: Response }> {
  const bearer = parseBearerToken(request.headers.get("authorization"));
  const token = await authenticateVoiceToken(bearer);

  if (!token) {
    return { response: voiceError("Unauthorized voice token", 401) };
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const limit = rateLimit(
    getRequestIdentity(ip, `voice-${options.scope}-${token.id}`),
    options.maxRequests ?? 60,
    options.windowMs ?? 60 * 1000
  );

  if (!limit.allowed) {
    return {
      response: voiceError("Rate limit exceeded", 429, {
        "Retry-After": String(limit.retryAfterSeconds)
      })
    };
  }

  return { token };
}
