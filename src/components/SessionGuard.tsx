"use client";

import { useEffect, useRef } from "react";
import { clearIndexedDB } from "@/lib/offline/db";

/**
 * Session Integrity Guard.
 *
 * On every page load (except auth-neutral routes), compares the
 * server-side `session` cookie userId against localStorage.
 *
 * - If they differ the browser has stale/cross-user data → wipe everything.
 * - If the server has no session but localStorage thinks it's logged in → wipe.
 *
 * Must be mounted inside the root layout so it runs on every navigation.
 */
export default function SessionGuard() {
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;

    const path = window.location.pathname;

    // Skip auth-neutral / customer-only routes where the session cookie
    // is not the primary auth mechanism
    if (
      path === "/login" ||
      path === "/scan" ||
      path === "/onboard" ||
      path.startsWith("/customer/") ||
      path.startsWith("/api/") ||
      path.startsWith("/business/") ||
      path === "/"
    ) {
      return;
    }

    const localId = localStorage.getItem("merchant_id");

    // If nothing is stored locally there's nothing to leak — skip check
    if (!localId) return;

    (async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        const data: { userId: string | null } = await res.json();

        if (!data.userId || data.userId !== localId) {
          // Session mismatch — stale / cross-user data detected
          localStorage.clear();
          sessionStorage.clear();
          await clearIndexedDB();
          document.cookie.split(";").forEach((c) => {
            const name = c.trim().split("=")[0];
            document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; max-age=0`;
          });
          if ("caches" in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
          }
          window.location.replace("/login");
        }
      } catch {
        // Fetch failed — network issue, don't force logout
      }
    })();
  }, []);

  return null;
}
