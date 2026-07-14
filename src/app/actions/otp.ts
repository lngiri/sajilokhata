"use server";

import { cookies } from "next/headers";
import { sendTransactionSMS } from "./sms";
import { getAdminClient } from "@/lib/supabase/admin";

export async function sendLoginOtp(
  phone: string
): Promise<{ success: boolean; error?: string }> {
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

  const message = `Your OTP code for QRHisab is: ${code}. Do not share this code.`;
  return sendTransactionSMS(cleanPhone, message);
}

export async function verifyLoginOtp(
  phone: string,
  code: string
): Promise<{ success: boolean; error?: string; userId?: string }> {
  const cleanPhone = phone.replace(/\D/g, "").slice(-10);

  const cookieStore = await cookies();
  const storedCode = cookieStore.get("otp_code")?.value;
  const storedPhone = cookieStore.get("otp_phone")?.value;

  if (!storedCode || !storedPhone) {
    return { success: false, error: "OTP expired. Please request a new one." };
  }

  if (storedPhone !== cleanPhone) {
    return { success: false, error: "Phone number mismatch" };
  }

  if (storedCode !== code) {
    return { success: false, error: "Invalid OTP. Please try again." };
  }

  // Clear OTP cookies
  cookieStore.delete("otp_code");
  cookieStore.delete("otp_phone");

  // Ensure user exists in Supabase Auth via admin API
  const admin = getAdminClient();
  if (!admin) {
    return { success: false, error: "Authentication service unavailable" };
  }

  let userId: string | null = null;

  try {
    const { data, error } = await admin.auth.admin.createUser({
      phone: `+977${cleanPhone}`,
      phone_confirm: true,
    });
    if (error) throw error;
    userId = data.user?.id || null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // User already exists — find their ID
    if (msg.includes("already exists") || msg.includes("already registered")) {
      const { data: users } = await admin.auth.admin.listUsers();
      const existing = users?.users?.find(
        (u: any) => u.phone === `+977${cleanPhone}`
      );
      userId = existing?.id || null;
    } else {
      console.error("[OTP] Error creating user:", msg);
      return { success: false, error: "Failed to verify. Please try again." };
    }
  }

  if (!userId) {
    return { success: false, error: "Could not find or create user account" };
  }

  console.log("[OTP] Verified successfully for user:", userId);

  // Create a merchant entry if needed
  try {
    await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || "https://www.qrhisab.com"}/api/merchant/setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        merchant_id: userId,
        phone: `+977${cleanPhone}`,
      }),
    });
  } catch {
    // Non-critical
  }

  return { success: true, userId };
}
