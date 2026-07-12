const store = new Map<string, number[]>();

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;

export function checkRateLimit(key: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const timestamps = store.get(key) || [];
  const withinWindow = timestamps.filter((t) => now - t < WINDOW_MS);

  if (withinWindow.length >= MAX_REQUESTS) {
    const retryAfter = Math.ceil((withinWindow[0] + WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfter };
  }

  withinWindow.push(now);
  store.set(key, withinWindow);
  return { allowed: true, retryAfter: 0 };
}
