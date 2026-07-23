"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Unregister any old SW registered at /sw.js (without version param)
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        const url = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL;
        if (url && new URL(url).pathname === "/sw.js") {
          reg.unregister();
        }
      }
    });

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        registration.update().catch(() => {});

        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                newWorker.postMessage({ type: "SKIP_WAITING" });
              }
            });
          }
        });
      })
      .catch((error) => {
        console.log("SW registration failed:", error);
      });

    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }, []);

  return null;
}
