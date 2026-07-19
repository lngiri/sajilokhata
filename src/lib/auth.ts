"use client";

import { createClient } from "@/lib/supabase/client";
import { clearCachedClient } from "@/lib/actions";
import { clearIndexedDB } from "@/lib/offline/db";

/**
 * Get the current merchant ID.
 *
 * Preference order:
 *  1. localStorage (set by the custom login flow — source of truth)
 *  2. Supabase Auth session (legacy users before custom-auth migration)
 *
 * NEVER overwrites localStorage — that would create a cross-session leak
 * if a stale Supabase session returns a different userId.
 */
export async function getCurrentMerchantId(): Promise<string | null> {
  // localStorage is the authoritative source for our custom auth flow
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("merchant_id");
    if (stored) return stored;
  }

  // Fallback: legacy Supabase Auth session (pre-custom-auth users)
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) return user.id;
  } catch {
    // Supabase not available
  }

  return null;
}

/**
 * Get the current user's phone number.
 *
 * Preference order:
 *  1. localStorage (set by the custom login flow)
 *  2. Supabase Auth session (legacy)
 *  3. auth_bypass_phone cookie
 */
export async function getCurrentUserPhone(): Promise<string | null> {
  // localStorage is the authoritative source for our custom auth flow
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("merchant_phone");
    if (stored) return stored;
  }

  // Fallback: legacy Supabase Auth session
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.phone) return user.phone;
  } catch {
    // Supabase not available
  }

  // Fallback: read from auth_bypass_phone cookie (set by bypass login)
  if (typeof document !== "undefined") {
    const match = document.cookie.match(/(?:^|;\s*)auth_bypass_phone=([^;]*)/);
    if (match) {
      return decodeURIComponent(match[1]);
    }
  }

  return null;
}

/**
 * Sign out the current user and clear stored session.
 */
export async function signOut() {
  try {
    // 1. Supabase signout (fire-and-forget — must not block redirect)
    try {
      const supabase = createClient();
      supabase.auth.signOut().catch(() => {});
    } catch {
      // Ignore
    }
    clearCachedClient();

    // 2. Preserve essential app config
    const swVersion = localStorage.getItem("sw_version");
    const pwaDismissed = localStorage.getItem("pwa-install-dismissed");

    // 3. Wipe all client-side storage
    localStorage.clear();
    sessionStorage.clear();

    // 4. Restore app config
    if (swVersion) localStorage.setItem("sw_version", swVersion);
    if (pwaDismissed) localStorage.setItem("pwa-install-dismissed", pwaDismissed);
    // Fire-and-forget: don't await — redirect must not be blocked
    clearIndexedDB().catch(() => {});

    // 5. Clear client-accessible cookies
    document.cookie.split(";").forEach((c) => {
      const name = c.trim().split("=")[0];
      document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; max-age=0`;
    });

    // 6. Attempt to clear Service Worker caches (fire-and-forget)
    if ("caches" in window) {
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).catch(() => {});
    }

    // 7. Notify SW to skip waiting
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: "SKIP_WAITING" });
    }
  } catch {
    // Ignore — proceed to redirect regardless
  }

  // 8. LAST: Redirect to server-side signout which clears httpOnly session cookie
  window.location.replace("/api/auth/signout");
}
