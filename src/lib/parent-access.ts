import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { requireServerSession } from "@/lib/auth/session";
import { db } from "@/lib/db";

export async function getParentAccessState() {
  const session = await requireServerSession(["PARENT"]);

  const parent = await db.user.findFirst({
    where: {
      id: session.userId,
      familyId: session.familyId,
      role: Role.PARENT,
      isActive: true
    },
    select: {
      onboardingCompletedAt: true,
      family: {
        select: {
          name: true
        }
      }
    }
  });

  if (!parent) {
    redirect("/login" as never);
  }

  return {
    session,
    parent
  };
}

export async function requireCompletedParentOnboarding() {
  const access = await getParentAccessState();

  if (!access.parent.onboardingCompletedAt) {
    redirect("/parent" as never);
  }

  return access;
}
