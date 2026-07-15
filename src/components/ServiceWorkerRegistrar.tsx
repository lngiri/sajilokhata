"use client";

import { useEffect } from "react";

const SW_VERSION = "v4";

function forceClearAllCaches() {
  if ("caches" in window) {
    caches.keys().then((keys) => {
      keys.forEach((key) => caches.delete(key));
    });
  }
}

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    const prevVersion = localStorage.getItem("sw_version");
    if (prevVersion && prevVersion !== SW_VERSION) {
      forceClearAllCaches();
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister());
      });
    }
    localStorage.setItem("sw_version", SW_VERSION);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register(`/sw.js?v=${SW_VERSION}`)
        .then((registration) => {
          registration.update();
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
