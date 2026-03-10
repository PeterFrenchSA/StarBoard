import { PointTransactionType } from "@prisma/client";
import { db } from "@/lib/db";

interface CreatePointTransactionInput {
  familyId: string;
  childId: string;
  actorId?: string | null;
  type: PointTransactionType;
  amount: number;
  note: string;
  referenceType?: string;
  referenceId?: string;
}

export async function createPointTransaction(input: CreatePointTransactionInput) {
  return db.pointTransaction.create({
    data: {
      familyId: input.familyId,
      childId: input.childId,
      actorId: input.actorId ?? null,
      type: input.type,
      amount: input.amount,
      note: input.note,
      referenceType: input.referenceType,
      referenceId: input.referenceId
    }
  });
}

export async function getChildPoints(familyId: string, childId: string): Promise<number> {
  const result = await db.pointTransaction.aggregate({
    where: { familyId, childId },
    _sum: { amount: true }
  });

  return result._sum.amount ?? 0;
}

export async function getPointsByChildIds(
  familyId: string,
  childIds: string[]
): Promise<Record<string, number>> {
  if (!childIds.length) {
    return {};
  }

  const grouped = await db.pointTransaction.groupBy({
    by: ["childId"],
    where: {
      familyId,
      childId: { in: childIds }
    },
    _sum: {
      amount: true
    }
  });

  return grouped.reduce<Record<string, number>>((acc, entry) => {
    acc[entry.childId] = entry._sum.amount ?? 0;
    return acc;
  }, {});
}
