import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request);
  if (auth.response) {
    return auth.response;
  }

  return Response.json({ data: auth.session });
}
