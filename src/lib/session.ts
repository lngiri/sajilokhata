const SESSION_COOKIE = "session";
const SESSION_DURATION = 30 * 24 * 60 * 60; // 30 days

async function hmacSign(payload: string): Promise<string> {
  const secret =
    process.env.SUPABASE_SERVICE_ROLE_KEY || "session-secret-fallback";
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSessionToken(userId: string): Promise<{
  token: string;
  maxAge: number;
}> {
  const expiresAt = Date.now() + SESSION_DURATION * 1000;
  const payload = `${userId}.${expiresAt}`;
  const signature = await hmacSign(payload);
  return { token: `${payload}.${signature}`, maxAge: SESSION_DURATION };
}

/**
 * Create a session token with a custom TTL (in seconds).
 * Used for "Remember Me" — short (1hr) or persistent (30d).
 */
export async function createSessionTokenWithTTL(
  userId: string,
  ttlSeconds: number
): Promise<{ token: string; maxAge: number }> {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  const payload = `${userId}.${expiresAt}`;
  const signature = await hmacSign(payload);
  return { token: `${payload}.${signature}`, maxAge: ttlSeconds };
}

export async function verifySessionToken(
  token: string
): Promise<string | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expiresAt, signature] = parts;
  const payload = `${userId}.${expiresAt}`;
  const expected = await hmacSign(payload);
  if (signature !== expected) return null;
  if (Date.now() > Number(expiresAt)) return null;
  return userId;
}

export { SESSION_COOKIE, SESSION_DURATION };
