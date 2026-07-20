const CACHE_NAME = "qrhisab-v8";
const STATIC_ASSETS = [
  "/",
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
  if (url.protocol !== "http:" && url.protocol !== "https:") return;
  if (url.hostname.includes("supabase")) return;
  if (url.hostname.includes("formspree")) return;
  if (AUTH_ROUTES.some((p) => url.pathname === p || url.pathname.startsWith(p))) return;

  // Network-first for _next/static (JS/CSS bundles) — prevents stale bundles
  if (url.pathname.startsWith("/_next/")) {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        } catch {
          const cached = await caches.match(request);
          if (cached) return cached;
          return Response.error();
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        if (response.ok || response.type === "opaque") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      } catch (err) {
        const cached = await caches.match(request);
        if (cached) return cached;

        if (request.mode === "navigate") {
          const fallback = await caches.match("/");
          if (fallback) return fallback;
        }

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
