import { describe, it, expect } from "vitest";
import { generateOtpCode, hashOtpCode, verifyOtpCode } from "./otp";

process.env.SESSION_HMAC_SECRET = "test-secret";

describe("otp lib", () => {
  it("generates a 6-digit code with a cryptographically-secure RNG", () => {
    const code = generateOtpCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it("hashes codes for storage at rest (64 hex chars)", () => {
    const hash = hashOtpCode("123456");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toBe("123456");
  });

  it("verifies a correct hashed code", () => {
    const hash = hashOtpCode("123456");
    expect(verifyOtpCode("123456", hash)).toBe(true);
  });

  it("rejects a wrong hashed code", () => {
    const hash = hashOtpCode("123456");
    expect(verifyOtpCode("654321", hash)).toBe(false);
  });

  it("remains backward compatible with legacy plaintext-stored codes", () => {
    expect(verifyOtpCode("123456", "123456")).toBe(true);
    expect(verifyOtpCode("123456", "111111")).toBe(false);
  });

  it("uses the same secret for deterministic hashing", () => {
    expect(hashOtpCode("123456")).toBe(hashOtpCode("123456"));
  });
});
