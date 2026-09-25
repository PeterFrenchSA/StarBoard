import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export function hasPrismaErrorCode(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

// Retry only aborted transactions. Callbacks must contain database work, not external side effects.
export async function runSerializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await db.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (!hasPrismaErrorCode(error, "P2034") || attempt >= 3) {
        throw error;
      }
    }
  }
}
