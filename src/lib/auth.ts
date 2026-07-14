"use client";

import { createClient } from "@/lib/supabase/client";
import { clearCachedClient } from "@/lib/actions";

/**
 * Get the current merchant ID from the Supabase auth session.
 * Always fetches from the server — no stale in-memory cache.
 * Falls back to localStorage only when no auth session exists (bypass/demo mode).
 */
export async function getCurrentMerchantId(): Promise<string | null> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      localStorage.setItem("merchant_id", user.id);
      return user.id;
    }
  } catch {
    // Supabase not available
  }

  // Fallback: localStorage (bypass/demo mode where there's no real auth session)
  if (typeof window !== "undefined") {
    return localStorage.getItem("merchant_id");
  }

  return null;
}

/**
 * Get the current user's phone number from the Supabase auth session.
 * Returns null if not available.
 */
export async function getCurrentUserPhone(): Promise<string | null> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user?.phone) {
      return user.phone;
    }
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
