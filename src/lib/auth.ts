"use client";

import { createClient } from "@/lib/supabase/client";

let cachedMerchantId: string | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get the current merchant ID from Supabase session or localStorage fallback.
 * Used by all merchant pages to replace DEMO_MERCHANT_ID.
 * Results are cached for 5 minutes to avoid redundant auth checks.
 */
export async function getCurrentMerchantId(): Promise<string | null> {
  const now = Date.now();

  // Return cached value if still valid
  if (cachedMerchantId !== null && now - cacheTimestamp < CACHE_TTL) {
    return cachedMerchantId;
  }

  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      localStorage.setItem("merchant_id", user.id);
      cachedMerchantId = user.id;
      cacheTimestamp = now;
      return user.id;
    }
  } catch {
    // Supabase not configured, fall back to localStorage
  }

  // Fallback: check localStorage for a stored merchant_id
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("merchant_id");
    cachedMerchantId = stored;
    cacheTimestamp = now;
    return stored;
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
  localStorage.removeItem("merchant_id");
  cachedMerchantId = null;
  cacheTimestamp = 0;
  window.location.href = "/login";
}
