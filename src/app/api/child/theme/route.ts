import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/session";
import { hasValidSameOrigin } from "@/lib/csrf";
import { db } from "@/lib/db";
import { parseJsonBody } from "@/lib/http";
import { updateChildThemeSchema } from "@/lib/validation/child";

export async function POST(request: NextRequest) {
  if (!hasValidSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const auth = await requireApiSession(request, ["CHILD"]);
  if (auth.response) {
    return auth.response;
  }

  const payload = await parseJsonBody(request, updateChildThemeSchema);
  if ("error" in payload) {
    return payload.error;
  }

  const updatedProfile = await db.childProfile.upsert({
    where: { userId: auth.session!.userId },
    update: {
      colorTheme: payload.data.theme
    },
    create: {
      userId: auth.session!.userId,
      colorTheme: payload.data.theme
    },
    select: {
      colorTheme: true
    }
  });

  return Response.json({ data: updatedProfile });
}
