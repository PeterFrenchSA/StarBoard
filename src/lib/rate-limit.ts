interface LimitRecord {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, LimitRecord>();
const MAX_RECORDS = 10_000;
let nextSweepAt = 0;
let earliestResetAt = 0;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  if (now >= nextSweepAt) {
    earliestResetAt = Infinity;
    for (const [storedKey, record] of memoryStore) {
      if (now >= record.resetAt) {
        memoryStore.delete(storedKey);
      } else {
        earliestResetAt = Math.min(earliestResetAt, record.resetAt);
      }
    }
    nextSweepAt = now + 1000;
  }
  const existing = memoryStore.get(key);

  // Preserve active limits at capacity; evicting them would allow brute-force bypasses.
  if (!existing && memoryStore.size >= MAX_RECORDS) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((earliestResetAt - now) / 1000))
    };
  }

  if (!existing || now >= existing.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    earliestResetAt = Math.min(earliestResetAt, now + windowMs);
    return {
      allowed: true,
      remaining: limit - 1,
      retryAfterSeconds: Math.ceil(windowMs / 1000)
    };
  }

  existing.count += 1;

  if (existing.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000)
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000)
  };
}

export function getRequestIdentity(ip: string | null, route: string): string {
  return `${ip ?? "unknown"}:${route}`;
}
