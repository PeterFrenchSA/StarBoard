import { afterEach, describe, expect, it, vi } from "vitest";
import { rateLimit } from "@/lib/rate-limit";

describe("rateLimit", () => {
  afterEach(() => vi.useRealTimers());
  it("blocks after limit is exceeded", () => {
    const first = rateLimit("test-key", 2, 5_000);
    const second = rateLimit("test-key", 2, 5_000);
    const third = rateLimit("test-key", 2, 5_000);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
  });

  it("resets the limit exactly at expiry", () => {
    vi.useFakeTimers();
    expect(rateLimit("expiry-key", 1, 1000).allowed).toBe(true);
    expect(rateLimit("expiry-key", 1, 1000).allowed).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(rateLimit("expiry-key", 1, 1000).allowed).toBe(true);
  });

  it("caps identities without evicting active limits, then frees expired entries", async () => {
    vi.resetModules();
    const { rateLimit: freshLimit } = await import("./rate-limit");
    vi.useFakeTimers();
    for (let index = 0; index < 10_000; index += 1) {
      expect(freshLimit(`identity-${index}`, 1, 1000).allowed).toBe(true);
    }
    expect(freshLimit("overflow", 1, 1000).allowed).toBe(false);
    expect(freshLimit("identity-0", 1, 1000).allowed).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(freshLimit("overflow", 1, 1000).allowed).toBe(true);
  });
});
