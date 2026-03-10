import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { getParentOverviewData } from "@/lib/dashboard";

export async function GET(request: NextRequest) {
  const auth = await requireApiSession(request, ["PARENT"]);
  if (auth.response) {
    return auth.response;
  }

  const data = await getParentOverviewData(auth.session!.familyId);
  return Response.json({ data });
}
