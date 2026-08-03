import { createHash, randomInt, timingSafeEqual } from "node:crypto";

/**
 * Generate a cryptographically-secure 6-digit OTP.
 */
export function generateOtpCode(): string {
  return String(randomInt(100000, 1000000));
}

function getOtpSecret(): string {
  const secret =
    process.env.SESSION_HMAC_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error(
      "CRITICAL_SECURITY_ERROR: Secure HMAC secret key is missing. "
      + "Set SESSION_HMAC_SECRET (or SUPABASE_SERVICE_ROLE_KEY) in your environment."
    );
  }
  return secret;
}

/**
 * Hash an OTP for storage at rest. Plaintext codes are never persisted.
 */
export function hashOtpCode(otp: string): string {
  return createHash("sha256").update(`${otp}:${getOtpSecret()}`).digest("hex");
}

/**
 * Verify a user-supplied OTP against a stored value.
 * Backward compatible: legacy invites stored plaintext 6-digit codes.
 */
export function verifyOtpCode(otp: string, stored: string): boolean {
  if (/^\d{6}$/.test(stored)) {
    return stored === otp;
  }
  const expected = Buffer.from(hashOtpCode(otp), "hex");
  const actual = Buffer.from(stored, "hex");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
