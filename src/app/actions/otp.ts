"use server";

import { cookies, headers } from "next/headers";
import { getAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/phone";
import { createSessionToken, SESSION_COOKIE } from "@/lib/session";
import { findUserByPhone } from "./pin";

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

    const code = String(Math.floor(100000 + Math.random() * 900000));
    console.log("[OTP] Generated code:", code, "for phone:", cleanPhone);

    const cookieStore = await cookies();
    cookieStore.set("otp_code", code, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 300, // 5 minutes
      path: "/",
    });
    cookieStore.set("otp_phone", cleanPhone, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 300,
      path: "/",
    });

    // Send SMS
    const { sendTransactionSMS } = await import("./sms");
    const message = `Your OTP for QRHisab is: ${code}. Valid for 5 minutes.`;
    return sendTransactionSMS(cleanPhone, message);
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
 * On success, creates a merchant row (if not exists) and sets the session cookie.
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
      return { success: false, error: "OTP expired. Please request a new one." };
    }

    if (storedPhone !== cleanPhone) {
      console.log("[OTP] Phone mismatch: stored:", storedPhone, "input:", cleanPhone);
      return { success: false, error: "Phone number mismatch." };
    }

    if (storedCode !== code) {
      console.log("[OTP] Code mismatch: stored:", storedCode, "input:", code);
      return { success: false, error: "Invalid OTP. Please try again." };
    }

    // Clear OTP cookies
    cookieStore.delete("otp_code");
    cookieStore.delete("otp_phone");
    console.log("[OTP] OTP verified successfully for phone:", cleanPhone);

    // ---- 2. Check if user already exists ----
    const admin = getAdminClient();
    if (!admin) {
      // Dev mode — no DB fallback
      const localId = `local_${cleanPhone}`;
      const { token, maxAge } = await createSessionToken(localId);
      cookieStore.set(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge,
        path: "/",
      });
      return { success: true, userId: localId, phone: cleanPhone, userType: "merchant" };
    }

    const existing = await findUserByPhone(cleanPhone);
    console.log("[OTP] Existing user lookup:", JSON.stringify(existing));
    let userId: string | null = null;
    let userType: "merchant" | "customer" | "both" = "merchant";

    if (existing.merchant) {
      userId = existing.merchant.id;
      userType = existing.customer ? "both" : "merchant";
      console.log("[OTP] Found existing merchant:", userId, "userType:", userType);
    } else if (existing.customer) {
      userId = existing.customer.id;
      userType = "customer";
      console.log("[OTP] Found existing customer:", userId);
    }

    // ---- 3. Create merchant row if new user ----
    if (!userId) {
      console.log("[OTP] No existing user → creating new merchant");
      userId = crypto.randomUUID();
      const normalizedPhone = normalizePhone(cleanPhone);

      const { error: upsertError } = await (admin.from("merchants") as any).upsert(
        {
          id: userId,
          phone: normalizedPhone,
          name: "Shop",
          business_type: "kirana",
        },
        { onConflict: "id" }
      );

      if (upsertError) {
        console.error("[OTP] Failed to create merchant row:", upsertError);
        return { success: false, error: "Could not create account. Please try again." };
      }

      console.log("[OTP] Created new merchant:", userId);
      userType = "merchant";
    }

    // ---- 4. Set session cookie ----
    console.log("[OTP] Creating session token for user:", userId);
    const { token, maxAge } = await createSessionToken(userId);
    cookieStore.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge,
      path: "/",
    });
    console.log("[OTP] Session cookie set for user:", userId, "| maxAge:", maxAge, "| token length:", token.length);

    // Verify cookie was written by reading it back
    const verifyCookie = cookieStore.get(SESSION_COOKIE)?.value;
    console.log("[OTP] Post-set cookie check:", !!verifyCookie, "| matches:", verifyCookie === token);

    // ---- 5. Record session in DB ----
    try {
      const headersList = await headers();
      const userAgent = headersList.get("user-agent") || "";
      const ip = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "";
      await (admin.from("sessions") as any).insert({
        merchant_id: userId,
        device_info: userAgent,
        ip_address: ip,
      });
    } catch (e) {
      console.warn("[OTP] Session record failed:", e);
    }

    return { success: true, userId, phone: cleanPhone, userType };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[OTP] verifyRegistrationOtp error:", msg);
    return { success: false, error: "Internal error. Please try again." };
  }
}
