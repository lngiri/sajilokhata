"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      // Bump this version to force re-registration (cache-bust)
      const SW_VERSION = "v3";
      navigator.serviceWorker
        .register(`/sw.js?v=${SW_VERSION}`)
        .then((registration) => {
          console.log("SW registered:", registration.scope);

          // Check for updates on every page load
          registration.update();

          // If a new SW is waiting, activate it immediately
          if (registration.waiting) {
            registration.waiting.postMessage({ type: "SKIP_WAITING" });
          }

          // When a new SW is found, activate ASAP
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

      // When the new SW takes over, reload to use fresh assets
      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }
  }, []);

  return null;
}
