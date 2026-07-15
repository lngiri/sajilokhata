const ADMIN_SESSION_COOKIE = "admin_session";
const ADMIN_SESSION_DURATION = 2 * 60 * 60; // 2 hours (shorter than merchant sessions)

function getHmacKey(): string {
  const key = process.env.SESSION_HMAC_SECRET
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || "admin-session-secret-fallback";
  return key;
}

async function hmacSign(payload: string): Promise<string> {
  const secret = getHmacKey();
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

export async function createAdminSessionToken(adminId: string): Promise<{
  token: string;
  maxAge: number;
}> {
  const expiresAt = Date.now() + ADMIN_SESSION_DURATION * 1000;
  const payload = `${adminId}.${expiresAt}`;
  const signature = await hmacSign(payload);
  return { token: `${payload}.${signature}`, maxAge: ADMIN_SESSION_DURATION };
}

export async function verifyAdminSessionToken(
  token: string
): Promise<string | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [adminId, expiresAt, signature] = parts;
  const payload = `${adminId}.${expiresAt}`;
  const expected = await hmacSign(payload);
  if (signature !== expected) return null;
  if (Date.now() > Number(expiresAt)) return null;
  return adminId;
}

export { ADMIN_SESSION_COOKIE, ADMIN_SESSION_DURATION };
