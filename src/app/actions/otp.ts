"use server";

import { cookies } from "next/headers";
import { sendTransactionSMS } from "./sms";
import { getAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/phone";
import { createSessionToken, createSessionTokenWithTTL, SESSION_COOKIE } from "@/lib/session";

export async function sendLoginOtp(
  phone: string
): Promise<{ success: boolean; error?: string }> {
  console.log("[OTP] sendLoginOtp called with phone:", phone);

  try {
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    if (cleanPhone.length !== 10) {
      console.warn("[OTP] Invalid phone number:", phone);
      return { success: false, error: "Invalid phone number" };
    }

    // NOTE: No database/Supabase lookup happens here.
    // The SMS is sent unconditionally — works for both new and existing users.
    const code = String(Math.floor(100000 + Math.random() * 900000));
    console.log("[OTP] Generated code:", code, "for phone:", cleanPhone);

    const cookieStore = await cookies();
    cookieStore.set("otp_code", code, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 300,
      path: "/",
    });
    cookieStore.set("otp_phone", cleanPhone, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 300,
      path: "/",
    });
    console.log("[OTP] Cookies set for phone:", cleanPhone);

    const message = `Your OTP code for QRHisab is: ${code}. Do not share this code.`;
    return sendTransactionSMS(cleanPhone, message);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[OTP] Unexpected error in sendLoginOtp:", msg);
    return { success: false, error: "Internal error. Please try again." };
  }
}

export async function verifyLoginOtp(
  phone: string,
  code: string,
  rememberMe: boolean = true
): Promise<{ success: boolean; error?: string; userId?: string; phone?: string }> {
  console.log("[OTP] verifyLoginOtp called for phone:", phone);

  try {
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);

    // ---- 1. Verify OTP against cookie ----
    const cookieStore = await cookies();
    const storedCode = cookieStore.get("otp_code")?.value;
    const storedPhone = cookieStore.get("otp_phone")?.value;

    if (!storedCode || !storedPhone) {
      console.warn("[OTP] No stored OTP cookie — expired or never sent");
      return { success: false, error: "OTP expired. Please request a new one." };
    }

    if (storedPhone !== cleanPhone) {
      console.warn("[OTP] Phone mismatch: stored", storedPhone, "vs", cleanPhone);
      return { success: false, error: "Phone number mismatch." };
    }

    if (storedCode !== code) {
      console.warn("[OTP] Invalid OTP: expected", storedCode, "got", code);
      return { success: false, error: "Invalid OTP. Please try again." };
    }

    // Clear OTP cookies immediately after successful verification
    cookieStore.delete("otp_code");
    cookieStore.delete("otp_phone");
    console.log("[OTP] OTP verified successfully for phone:", cleanPhone);

    // ---- 2. Find or create Supabase Auth user ----
    const admin = getAdminClient();
    if (!admin) {
      console.warn("[OTP] Admin client unavailable — using localStorage fallback");
      // If admin client is unavailable (no service role key configured),
      // return a synthetic userId so the login still works on local/dev
      return { success: true, userId: `local_${cleanPhone}` };
    }

    const normalizedPhone = normalizePhone(phone);
    let userId: string | null = null;

    // 2a. Try to find existing merchant by phone (fast path for returning users)
    try {
      const { data: existing } = await (admin.from("merchants") as any)
        .select("id")
        .eq("phone", normalizedPhone)
        .maybeSingle();
      if (existing?.id) {
        userId = existing.id;
        console.log("[OTP] Found existing merchant user:", userId);
      }
    } catch (err) {
      console.warn("[OTP] merchants lookup error (non-fatal):", err);
    }

    // 2b. If not found in merchants, try creating a new Auth user
    if (!userId) {
      try {
        const { data, error } = await admin.auth.admin.createUser({
          phone: normalizedPhone,
          phone_confirm: true,
        });
        if (error) throw error;
        userId = data.user?.id || null;
        console.log("[OTP] Created new Auth user:", userId);
      } catch (createErr) {
        const msg = createErr instanceof Error ? createErr.message : String(createErr);
        console.warn("[OTP] createUser failed:", msg);

        // 2c. User already exists in Auth but not in merchants table yet
        if (msg.includes("already exists") || msg.includes("already registered")) {
          try {
            const { data: users } = await admin.auth.admin.listUsers({
              perPage: 10000,
            });
            const matched = users?.users?.find(
              (u: any) => u.phone === normalizedPhone
            );
            userId = matched?.id || null;
            if (userId) {
              console.log("[OTP] Found existing Auth user via listUsers:", userId);
            }
          } catch (listErr) {
            console.error("[OTP] listUsers also failed:", listErr);
          }
        } else {
          console.error("[OTP] Unrecoverable createUser error:", msg);
          return { success: false, error: "Failed to verify. Please try again." };
        }
      }
    }

    if (!userId) {
      console.error("[OTP] Could not determine userId for phone:", cleanPhone);
      return { success: false, error: "Could not find or create user account" };
    }

    console.log("[OTP] Verified successfully for user:", userId);

    // ---- 3. Ensure merchant row exists ----
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_SITE_URL || "https://www.qrhisab.com"}/api/merchant/setup`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            merchant_id: userId,
            phone: normalizedPhone,
          }),
        }
      );
    } catch (err) {
      console.warn("[OTP] Merchant setup call failed (non-critical):", err);
    }

    // ---- 4. Set session cookie (short-lived or persistent) ----
    try {
      const { token, maxAge } = rememberMe
        ? await createSessionToken(userId)
        : await createSessionTokenWithTTL(userId, 60 * 60); // 1 hour
      cookieStore.set(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge,
        path: "/",
      });
      console.log(`[OTP] Session cookie set for user: ${userId} (${rememberMe ? "30d" : "1hr"})`);
    } catch (err) {
      console.warn("[OTP] Failed to set session cookie (non-fatal):", err);
    }

    return { success: true, userId, phone: normalizedPhone };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[OTP] Unexpected error in verifyLoginOtp:", msg);
    return { success: false, error: "Internal error. Please try again." };
  }
}
