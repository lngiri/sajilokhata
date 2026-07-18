const CACHE_NAME = "qrhisab-v5";
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
  "/merchant/billing",
  "/onboard",
  "/manifest.json",
];
const AUTH_ROUTES = ["/login", "/api/auth/"];

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

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

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;
  if (url.hostname.includes("supabase")) return;
  if (url.hostname.includes("formspree")) return;
  if (AUTH_ROUTES.some((p) => url.pathname === p || url.pathname.startsWith(p))) return;

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        // Only cache valid responses (prevent caching 404s)
        if (response.ok || response.type === "opaque") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      } catch (err) {
        // Network failed (offline or blocked)
        const cached = await caches.match(request);
        if (cached) return cached;

        // Fallback to offline page ONLY for navigation requests
        if (request.mode === "navigate") {
          const fallback = await caches.match("/");
          if (fallback) return fallback;
        }

        // Return a generic error response instead of undefined to prevent TypeError crashes
        return Response.error();
      }
    })()
  );
});

self.addEventListener("sync", (event) => {
  if (event.tag === "sync-pending-logs") {
    event.waitUntil(syncPendingLogs());
  }
});

async function syncPendingLogs() {
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({ type: "SYNC_STARTED" });
  });
}
