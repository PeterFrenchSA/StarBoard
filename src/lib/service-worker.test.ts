import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

function worker() {
  const handlers: Record<string, (event: unknown) => void> = {};
  const addAll = vi.fn().mockResolvedValue(undefined);
  const cache = { addAll, match: vi.fn().mockResolvedValue(undefined), put: vi.fn() };
  runInNewContext(readFileSync("public/sw.js", "utf8"), {
    self: {
      addEventListener: (name: string, fn: (event: unknown) => void) => { handlers[name] = fn; },
      location: { origin: "http://localhost" }, skipWaiting: vi.fn()
    },
    caches: { open: vi.fn().mockResolvedValue(cache) },
    fetch: vi.fn().mockResolvedValue(new Response("asset")),
    URL, Response
  });
  return { handlers, addAll };
}

describe("service worker privacy", () => {
  it("precaches only the public offline page and icons", async () => {
    const { handlers, addAll } = worker();
    let work: Promise<unknown> | undefined;
    handlers.install({ waitUntil: (value: Promise<unknown>) => { work = value; } });
    await work;
    expect(addAll).toHaveBeenCalledWith(["/offline", "/icons/icon-192.svg", "/icons/icon-maskable.svg"]);
  });

  it.each(["/parent?_rsc=123", "/child?_rsc=456", "/api/child/overview", "/login"])(
    "never caches data fetched from %s", (path) => {
      const { handlers } = worker();
      const respondWith = vi.fn();
      handlers.fetch({ request: { url: `http://localhost${path}`, method: "GET", mode: "cors" }, respondWith });
      expect(respondWith).not.toHaveBeenCalled();
    }
  );
});
