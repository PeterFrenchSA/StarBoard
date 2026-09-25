import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const transaction = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ db: { $transaction: transaction } }));
import { runSerializable } from "./transactions";

describe("serializable transaction retry", () => {
  beforeEach(() => vi.resetAllMocks());

  it("retries a rolled-back write conflict and returns the committed result", async () => {
    transaction.mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError("conflict", {
      code: "P2034", clientVersion: "test"
    })).mockResolvedValueOnce("committed");
    const work = vi.fn();
    await expect(runSerializable(work)).resolves.toBe("committed");
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(transaction).toHaveBeenLastCalledWith(work, { isolationLevel: "Serializable" });
  });

  it("does not retry arbitrary errors or retry conflicts indefinitely", async () => {
    transaction.mockRejectedValue(new Error("database unavailable"));
    await expect(runSerializable(vi.fn())).rejects.toThrow("database unavailable");
    expect(transaction).toHaveBeenCalledTimes(1);
    transaction.mockClear().mockRejectedValue(new Prisma.PrismaClientKnownRequestError("conflict", {
      code: "P2034", clientVersion: "test"
    }));
    await expect(runSerializable(vi.fn())).rejects.toThrow("conflict");
    expect(transaction).toHaveBeenCalledTimes(4);
  });
});
