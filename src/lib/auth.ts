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
    const supabase = createClient();
    await supabase.auth.signOut();
  } catch {
    // Ignore errors
  }
  clearCachedClient();

  // Wipe all client-side storage
  localStorage.clear();
  sessionStorage.clear();
  await clearIndexedDB();

  // Clear client-accessible cookies
  document.cookie.split(";").forEach((c) => {
    const name = c.trim().split("=")[0];
    document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; max-age=0`;
  });

  // Attempt to clear Service Worker caches
  if ("caches" in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch {
      // Ignore
    }
  }

  // Notify SW to skip waiting (if it's waiting for activation)
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({ type: "SKIP_WAITING" });
  }

  // Force hard navigation to sign-out endpoint which clears server-side cookies
  window.location.replace("/api/auth/signout");
}
