import { cachePut, cacheGet } from "@/lib/offline/db";

export interface CachedResult<T> {
  data: T;
  stale: boolean;
  cachedAt: string | null;
}

/**
 * Server-action fetch with an IndexedDB write-through / read-fallback cache.
 * - Success: result is cached and returned fresh.
 * - Failure (offline/network): last cached value is returned marked `stale`,
 *   so dashboards and lists still render while offline.
 *
 * Keys must include the acting user id — the store is wiped on sign-out.
 */
export async function fetchWithCache<T>(
  key: string,
  fn: () => Promise<T>
): Promise<CachedResult<T>> {
  try {
    const data = await fn();
    try {
      await cachePut(key, data);
    } catch {
      // Cache write failure is non-fatal
    }
    return { data, stale: false, cachedAt: null };
  } catch (err) {
    try {
      const cached = await cacheGet<T>(key);
      if (cached) return { data: cached.data, stale: true, cachedAt: cached.savedAt };
    } catch {
      // Cache read failure — surface the original error
    }
    throw err;
  }
}
