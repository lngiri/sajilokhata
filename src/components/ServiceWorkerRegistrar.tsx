"use client";

import { useState, useEffect, useRef } from "react";

export default function ServiceWorkerRegistrar() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const registered = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (registered.current) return;
    registered.current = true;

    let reg: ServiceWorkerRegistration | null = null;
    let cleanupUpdatefound: (() => void) | null = null;
    let cleanupStatechange: (() => void) | null = null;

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        reg = registration;
        registration.update().catch(() => {});

        if (registration.waiting) {
          setUpdateAvailable(true);
          return;
        }

        const onUpdateFound = () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          const onStateChange = () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              setUpdateAvailable(true);
            }
          };
          newWorker.addEventListener("statechange", onStateChange);
          cleanupStatechange = () => newWorker.removeEventListener("statechange", onStateChange);
        };

        registration.addEventListener("updatefound", onUpdateFound);
        cleanupUpdatefound = () => registration.removeEventListener("updatefound", onUpdateFound);
      })
      .catch((error) => {
        console.log("SW registration failed:", error);
      });

    return () => {
      cleanupUpdatefound?.();
      cleanupStatechange?.();
    };
  }, []);

  const handleRefresh = () => {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "SKIP_WAITING" });
    }
    window.location.reload();
  };

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-[100] animate-slide-up">
      <div className="mx-auto max-w-md bg-[var(--color-surface)] dark:bg-gray-800 rounded-2xl shadow-2xl border border-[var(--color-border)] p-4 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[var(--color-text)]">
          New version available
        </p>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] rounded-xl text-sm font-bold hover:bg-[var(--color-primary-surface-hover)] transition-all active:scale-[0.97] whitespace-nowrap"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
