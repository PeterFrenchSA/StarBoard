const CACHE_VERSION = "starboard-v2";
const SHELL_URLS = ["/", "/login", "/register", "/offline", "/icons/icon-192.svg", "/icons/icon-maskable.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL_URLS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

function isApiRequest(request) {
  const url = new URL(request.url);
  return url.pathname.startsWith("/api/");
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then((response) => {
      if (response.ok && request.method === "GET") {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    void networkFetch;
    return cached;
  }

  const network = await networkFetch;

  if (network) {
    return network;
  }

  return caches.match("/offline");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin || isApiRequest(request)) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_VERSION);
        return (await cache.match("/offline")) || Response.error();
      })
    );
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});
