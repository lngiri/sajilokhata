const CACHE_NAME = "qrhisab-v3";
const STATIC_ASSETS = [
  "/",
  "/login",
  "/scan",
  "/delivery",
  "/merchant/dashboard",
  "/merchant/customers",
  "/merchant/logs",
  "/merchant/qr",
  "/merchant/settings",
  "/manifest.json",
];

// Handle messages from the client (e.g., SKIP_WAITING)
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Install: cache all static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: Network-first for API calls, cache-first for static assets
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip Supabase API calls (always go to network)
  if (url.hostname.includes("supabase")) return;

  // For navigation requests: network-first with cache fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            return cachedResponse || caches.match("/");
          });
        })
    );
    return;
  }

  // For static assets (JS, CSS, images): network-first with cache fallback
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".woff2")
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            return cachedResponse || caches.match("/");
          });
        })
    );
    return;
  }

  // For everything else: network-first with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseClone);
        });
        return response;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});

// Handle background sync for offline entries
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-pending-logs") {
    event.waitUntil(syncPendingLogs());
  }
});

async function syncPendingLogs() {
  // Notify the client that sync is happening
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({ type: "SYNC_STARTED" });
  });
}
