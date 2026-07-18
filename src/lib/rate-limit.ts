import { getAdminClient } from "@/lib/supabase/admin";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;

export async function checkRateLimit(
  key: string
): Promise<{ allowed: boolean; retryAfter: number }> {
  const admin = getAdminClient();
  if (!admin) return { allowed: true, retryAfter: 0 };

  try {
    const now = Date.now();
    const windowStart = new Date(now - WINDOW_MS).toISOString();

    // 1. Clean up stale entries
    await admin.from("rate_limits").delete().lt("expires_at", new Date().toISOString());

    // 2. Get current count for this key
    const { data: row } = await admin
      .from("rate_limits")
      .select("count, expires_at")
      .eq("key", key)
      .maybeSingle();

    const record = row as { count: number; expires_at: string } | null;

    if (!record || new Date(record.expires_at).getTime() < now) {
      // First request or window expired — reset
      await admin.from("rate_limits").upsert(
        { key, count: 1, expires_at: new Date(now + WINDOW_MS).toISOString() },
        { onConflict: "key" }
      );
      return { allowed: true, retryAfter: 0 };
    }

    if (record.count >= MAX_REQUESTS) {
      const retryAfter = Math.ceil(
        (new Date(record.expires_at).getTime() - now) / 1000
      );
      return { allowed: false, retryAfter };
    }

    // Increment count
    await admin
      .from("rate_limits")
      .update({ count: record.count + 1 })
      .eq("key", key);

    return { allowed: true, retryAfter: 0 };
  } catch (err) {
    console.error("[RateLimit] DB error, allowing request:", err);
    return { allowed: true, retryAfter: 0 };
  }
}
