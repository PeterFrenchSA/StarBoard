import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { getChildOverviewData } from "@/lib/dashboard";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, ["CHILD"]);
  if (auth.response) {
    return auth.response;
  }

  const data = await getChildOverviewData(auth.session!.familyId, auth.session!.userId);
  return Response.json({ data });
}
