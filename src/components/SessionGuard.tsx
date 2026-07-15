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
        const data: { userId: string | null; forceLogout?: boolean; roles?: string[] } = await res.json();

        console.log(
          "[SessionGuard] Check result:",
          JSON.stringify({
            path,
            localId,
            apiUserId: data.userId,
            forceLogout: data.forceLogout,
            roles: data.roles,
            url: window.location.href,
            userAgent: navigator.userAgent?.slice(0, 80),
            timestamp: new Date().toISOString(),
          })
        );

        if (!data.userId || data.userId !== localId) {
          const reason = !data.userId
            ? "API returned null userId (cookie missing/invalid/user not found in DB)"
            : `API userId (${data.userId}) !== localStorage merchant_id (${localId})`;

          console.log(
            "[SessionGuard] SESSION MISMATCH —",
            { reason, forceLogout: data.forceLogout, path, localId, apiUserId: data.userId }
          );

          // Force logout — wipe immediately without retry
          if (data.forceLogout) {
            localStorage.setItem("logout_reason", "Your session was terminated by an administrator.");
            console.log("[SessionGuard] Force logout — wiping immediately");
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
            window.location.replace("/login?forceLogout=1");
            return;
          }

          // Non-force mismatch — retry once after 2s to allow cookie propagation
          console.log("[SessionGuard] Retrying session check in 2s...");
          await new Promise((r) => setTimeout(r, 2000));
          try {
            const res2 = await fetch("/api/auth/session", { cache: "no-store" });
            const data2 = await res2.json();
            console.log("[SessionGuard] Retry result:", JSON.stringify({ apiUserId: data2.userId, localId, forceLogout: data2.forceLogout }));
            if (data2.userId === localId) {
              console.log("[SessionGuard] Retry OK — session now valid");
              return;
            }
          } catch {
            console.warn("[SessionGuard] Retry fetch failed");
          }

          console.log("[SessionGuard] Wiping state after retry", { reason, path });
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
        } else {
          console.log("[SessionGuard] OK — session valid for userId:", localId);
        }
      } catch (err) {
        // Fetch failed — network issue, don't force logout
        console.warn("[SessionGuard] Fetch failed (network issue — no wipe):", err);
      }
    })();
  }, []);

  return null;
}
