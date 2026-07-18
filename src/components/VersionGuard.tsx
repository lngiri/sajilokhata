"use client";

import { useEffect, useRef } from "react";
import { APP_VERSION, VERSION_STORAGE_KEY } from "@/lib/version";
import { clearIndexedDB } from "@/lib/offline/db";

/**
 * Version Guard.
 *
 * Compares the current `APP_VERSION` against the version stored in
 * `localStorage` on every page load.
 *
 * - If different → the app was deployed since the last visit.
 *   All stale caches (SW cache, localStorage, sessionStorage, cookies)
 *   are wiped so the user gets a fresh state.
 * - On mismatch the stored version is updated so the check only
 *   fires once per version upgrade.
 */
export default function VersionGuard() {
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;

    const stored = localStorage.getItem(VERSION_STORAGE_KEY);

    // First visit ever (no stored version) — just save and return
    if (stored === null) {
      localStorage.setItem(VERSION_STORAGE_KEY, APP_VERSION);
      return;
    }

    // Version matches — nothing to do
    if (stored === APP_VERSION) return;

    // ── Version mismatch → deep clean ──
    (async () => {
      // Preserve essential app config
      const swVersion = localStorage.getItem("sw_version");
      const pwaDismissed = localStorage.getItem("pwa-install-dismissed");

      localStorage.clear();
      sessionStorage.clear();

      // Restore app config
      if (swVersion) localStorage.setItem("sw_version", swVersion);
      if (pwaDismissed) localStorage.setItem("pwa-install-dismissed", pwaDismissed);

      await clearIndexedDB();

      document.cookie.split(";").forEach((c) => {
        const name = c.trim().split("=")[0];
        document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; max-age=0`;
      });

      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }

      // Store new version so we don't loop
      localStorage.setItem(VERSION_STORAGE_KEY, APP_VERSION);

      // Hard reload to pick up fresh assets
      window.location.reload();
    })();
  }, []);

  return null;
}
