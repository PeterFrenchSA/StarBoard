import { ActivityType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

interface LogActivityInput {
  familyId: string;
  actorId?: string | null;
  childId?: string | null;
  type: ActivityType;
  message: string;
  metadata?: Prisma.InputJsonValue | null;
}

export async function logActivity(input: LogActivityInput): Promise<void> {
  await db.activityLog.create({
    data: {
      familyId: input.familyId,
      actorId: input.actorId ?? null,
      childId: input.childId ?? null,
      type: input.type,
      message: input.message,
      metadata: input.metadata === null ? Prisma.JsonNull : input.metadata
    }
  });
}
