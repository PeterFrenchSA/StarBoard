import { ActivityType, Role } from "@prisma/client";
import { NextRequest } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import { requireApiSession } from "@/lib/auth/session";
import { hasValidSameOrigin } from "@/lib/csrf";
import { db } from "@/lib/db";
import { hasPrismaErrorCode } from "@/lib/transactions";
import { parseJsonBody } from "@/lib/http";
import { createChildSchema } from "@/lib/validation/auth";

export async function POST(request: NextRequest) {
  if (!hasValidSameOrigin(request)) {
    return Response.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const auth = await requireApiSession(request, ["PARENT"]);
  if (auth.response) {
    return auth.response;
  }

  const payload = await parseJsonBody(request, createChildSchema);
  if ("error" in payload) {
    return payload.error;
  }

  const { childName, email, password, avatarEmoji } = payload.data;

  const existing = await db.user.findUnique({
    where: { email: email.toLowerCase() }
  });

  if (existing) {
    return Response.json({ error: "Email already in use" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  try {
    const child = await db.$transaction(async (tx) => {
      const child = await tx.user.create({
        data: {
          familyId: auth.session!.familyId,
          role: Role.CHILD,
          email: email.toLowerCase(),
          passwordHash,
          displayName: childName,
          childProfile: {
            create: {
              avatarEmoji
            }
          }
        },
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          createdAt: true,
          childProfile: {
            select: {
              avatarEmoji: true,
              colorTheme: true,
              currentStreak: true,
              longestStreak: true
            }
          }
        }
      });

      await tx.activityLog.create({
        data: {
          familyId: auth.session!.familyId,
          actorId: auth.session!.userId,
          childId: child.id,
          type: ActivityType.USER_CREATED,
          message: `${auth.session!.displayName} created child account for ${childName}`
        }
      });

      return child;
    });
    return Response.json({ data: child }, { status: 201 });
  } catch (error) {
    if (hasPrismaErrorCode(error, "P2002")) {
      return Response.json({ error: "Email already in use" }, { status: 409 });
    }
    throw error;
  }
}
