import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, requireApiSession } from "@/lib/auth/session";
import { hasValidSameOrigin } from "@/lib/csrf";

export async function POST(request: NextRequest) {
  if (!hasValidSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const auth = await requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  const response = NextResponse.json({ data: { success: true } });
  clearSessionCookie(response);
  return response;
}
