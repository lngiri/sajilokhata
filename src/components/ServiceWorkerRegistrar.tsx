"use client";

import { useEffect } from "react";

const SW_VERSION = "v4";

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    localStorage.setItem("sw_version", SW_VERSION);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register(`/sw.js?v=${SW_VERSION}`)
        .then((registration) => {
          // Explicitly check for updates
          registration.update().catch(() => {
            // Ignore update check failures (offline)
          });

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
    }
  }, []);

  return null;
}
