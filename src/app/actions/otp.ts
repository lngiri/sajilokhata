"use server";

import { cookies } from "next/headers";
import { getAdminClient } from "@/lib/supabase/admin";
import { createSessionToken, SESSION_COOKIE } from "@/lib/session";
import { findUserByPhone } from "./pin";
import { sendTransactionSMS } from "./sms";

// ──────────────────────────────────────────────
// OTP generation and storage (cookie-based)
// ──────────────────────────────────────────────

/**
 * Generate a 6-digit OTP, store it in an HTTP-only cookie (5 min TTL),
 * and send it via SMS.
 * Called ONLY for new user registration or forgot-PIN flows.
 */
export async function sendRegistrationOtp(
  phone: string
): Promise<{ success: boolean; error?: string }> {
  console.log("[OTP] sendRegistrationOtp called with phone:", phone);

  try {
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    if (cleanPhone.length !== 10) {
      return { success: false, error: "Invalid phone number" };
    }

    // Guard: fail fast if SMS gateway is not configured
    if (!process.env.AAKASH_SMS_TOKEN) {
      console.error("[OTP] AAKASH_SMS_TOKEN not configured — cannot send OTP");
      return { success: false, error: "SMS service not configured. Please contact support." };
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    console.log("[OTP] Generated code:", code, "for phone:", cleanPhone);

    const cookieStore = await cookies();
    cookieStore.set("otp_code", code, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 300, // 5 minutes
      path: "/",
    });
    cookieStore.set("otp_phone", cleanPhone, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 300,
      path: "/",
    });

    // Send SMS
    const message = `Your QR Hisab OTP is ${code}. Use this to complete your registration on QR Hisab.`;
    console.log("[OTP] Sending SMS to", cleanPhone, "with message:", message);
    const smsResult = await sendTransactionSMS(cleanPhone, message);
    console.log("[OTP] SMS result:", JSON.stringify(smsResult));
    return smsResult;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[OTP] sendRegistrationOtp error:", msg);
    return { success: false, error: "Failed to send OTP. Please try again." };
  }
}

// ──────────────────────────────────────────────
// OTP verification (new user registration)
// ──────────────────────────────────────────────

/**
 * Verify the OTP code against the stored cookie.
 * Returns info about existing users WITHOUT creating or modifying any records.
 * Session cookie is NOT set here — caller decides the next step.
 */
export async function verifyRegistrationOtp(
  phone: string,
  code: string
): Promise<{
  success: boolean;
  error?: string;
  userId?: string;
  phone?: string;
  userType?: "merchant" | "customer" | "both";
  exists: boolean;
  hasPin?: boolean;
}> {
  console.log("[OTP] verifyRegistrationOtp called for phone:", phone);

  try {
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);

    // ---- 1. Verify OTP against cookie ----
    const cookieStore = await cookies();
    const storedCode = cookieStore.get("otp_code")?.value;
    const storedPhone = cookieStore.get("otp_phone")?.value;

    console.log("[OTP] Verifying OTP, storedCode:", !!storedCode, "storedPhone:", storedPhone, "inputPhone:", cleanPhone, "inputCode:", code);

    if (!storedCode || !storedPhone) {
      console.log("[OTP] No stored OTP cookies (expired)");
      return { success: false, error: "OTP expired. Please request a new one.", exists: false };
    }

    if (storedPhone !== cleanPhone) {
      console.log("[OTP] Phone mismatch: stored:", storedPhone, "input:", cleanPhone);
      return { success: false, error: "Phone number mismatch.", exists: false };
    }

    if (storedCode !== code) {
      console.log("[OTP] Code mismatch: stored:", storedCode, "input:", code);
      return { success: false, error: "Invalid OTP. Please try again.", exists: false };
    }

    // Clear OTP cookies
    cookieStore.delete("otp_code");
    cookieStore.delete("otp_phone");
    console.log("[OTP] OTP verified successfully for phone:", cleanPhone);

    // ---- 2. Check if user already exists ----
    const admin = getAdminClient();
    if (!admin) {
      // Dev mode — no DB
      return { success: true, exists: false, phone: cleanPhone };
    }

    const existing = await findUserByPhone(cleanPhone);
    console.log("[OTP] Existing user lookup:", JSON.stringify(existing));

    if (existing.merchant && existing.customer) {
      const hasPin = !!(existing.merchant.pin_hash || existing.customer.pin_hash);
      return { success: true, exists: true, phone: cleanPhone, userType: "both", userId: existing.merchant.id, hasPin };
    }

    if (existing.merchant) {
      return {
        success: true,
        exists: true,
        userId: existing.merchant.id,
        phone: cleanPhone,
        userType: "merchant",
        hasPin: !!existing.merchant.pin_hash,
      };
    }

    if (existing.customer) {
      return {
        success: true,
        exists: true,
        userId: existing.customer.id,
        phone: cleanPhone,
        userType: "customer",
        hasPin: !!existing.customer.pin_hash,
      };
    }

    // No existing user — caller must create one via registerNewUser
    console.log("[OTP] No existing user — caller should create with role selection");
    return { success: true, exists: false, phone: cleanPhone };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[OTP] verifyRegistrationOtp error:", msg);
    return { success: false, error: "Internal error. Please try again.", exists: false };
  }
}
