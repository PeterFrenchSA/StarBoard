import { describe, expect, it } from "vitest";
import { rateLimit } from "@/lib/rate-limit";

describe("rateLimit", () => {
  it("blocks after limit is exceeded", () => {
    const first = rateLimit("test-key", 2, 5_000);
    const second = rateLimit("test-key", 2, 5_000);
    const third = rateLimit("test-key", 2, 5_000);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
  });
});
