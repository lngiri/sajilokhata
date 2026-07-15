"use server";

import { cookies, headers } from "next/headers";
import bcrypt from "bcryptjs";
import { getAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/phone";
import { createSessionToken, SESSION_COOKIE } from "@/lib/session";

const PIN_ROUNDS = 10;

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, PIN_ROUNDS);
}

/**
 * Find a user by phone in both merchants and customers tables.
 * Returns the user record(s) found.
 */
export async function findUserByPhone(phone: string): Promise<{
  merchant?: { id: string; pin_hash: string | null };
  customer?: { id: string; pin_hash: string | null };
}> {
  const admin = getAdminClient();
  if (!admin) return {};

  const np = normalizePhone(phone);
  const [mRes, cRes] = await Promise.all([
    (admin.from("merchants") as any)
      .select("id, pin_hash")
      .eq("phone", np)
      .maybeSingle(),
    (admin.from("customers") as any)
      .select("id, pin_hash")
      .eq("phone", np)
      .maybeSingle(),
  ]);

  return {
    merchant: mRes?.data || undefined,
    customer: cRes?.data || undefined,
  };
}

export interface UserInfo {
  userId: string;
  hasPin: boolean;
  userType: "merchant" | "customer" | "both";
}

/**
 * Check if a phone number belongs to an existing user and whether they have a PIN.
 */
export async function checkUserExists(phone: string): Promise<{
  exists: boolean;
  users: UserInfo[];
}> {
  const { merchant, customer } = await findUserByPhone(phone);
  const users: UserInfo[] = [];

  if (merchant) {
    users.push({
      userId: merchant.id,
      hasPin: !!merchant.pin_hash,
      userType: "merchant",
    });
  }
  if (customer) {
    // If same ID as merchant → already added as 'both'
    const existing = users.find((u) => u.userId === customer.id);
    if (existing) {
      existing.userType = "both";
      existing.hasPin = existing.hasPin || !!customer.pin_hash;
    } else {
      users.push({
        userId: customer.id,
        hasPin: !!customer.pin_hash,
        userType: "customer",
      });
    }
  }

  return { exists: users.length > 0, users };
}

export async function checkHasPin(userId: string): Promise<{ hasPin: boolean }> {
  const admin = getAdminClient();
  if (!admin) return { hasPin: false };

  const [mRes, cRes] = await Promise.all([
    (admin.from("merchants") as any)
      .select("pin_hash")
      .eq("id", userId)
      .maybeSingle(),
    (admin.from("customers") as any)
      .select("pin_hash")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  const hasPin = !!(mRes?.data?.pin_hash || cRes?.data?.pin_hash);
  return { hasPin };
}

export async function verifyPin(
  userId: string,
  pin: string
): Promise<{ success: boolean; error?: string }> {
  if (!pin || pin.length < 4 || pin.length > 6) {
    return { success: false, error: "PIN must be 4-6 digits" };
  }

  const admin = getAdminClient();
  if (!admin) return { success: false, error: "Server config" };

  const [mRes, cRes] = await Promise.all([
    (admin.from("merchants") as any)
      .select("pin_hash")
      .eq("id", userId)
      .maybeSingle(),
    (admin.from("customers") as any)
      .select("pin_hash")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  const storedHash = mRes?.data?.pin_hash || cRes?.data?.pin_hash;

  if (!storedHash) {
    return { success: false, error: "No PIN set" };
  }

  const match = await bcrypt.compare(pin, storedHash);
  if (!match) {
    return { success: false, error: "Incorrect PIN" };
  }

  return { success: true };
}

/**
 * Verify PIN and create a session. Called after PIN entry.
 */
export async function loginWithPin(
  userId: string,
  pin: string,
  userType: "merchant" | "customer" | "both"
): Promise<{ success: boolean; error?: string; redirect?: string }> {
  console.log("[loginWithPin] Verifying PIN for user:", userId);
  const verified = await verifyPin(userId, pin);
  if (!verified.success) {
    console.log("[loginWithPin] PIN verification failed:", verified.error);
    return verified;
  }

  try {
    const admin = getAdminClient();
    const cookieStore = await cookies();

    // Create session cookie
    console.log("[loginWithPin] Creating session for user:", userId);
    const { token, maxAge } = await createSessionToken(userId);
    cookieStore.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge,
      path: "/",
    });
    console.log("[loginWithPin] Session cookie set");

    // Record session in DB
    if (admin) {
      try {
        const headersList = await headers();
        const userAgent = headersList.get("user-agent") || "";
        const ip = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "";
        await (admin.from("sessions") as any).insert({
          merchant_id: userId,
          device_info: userAgent,
          ip_address: ip,
        });
        console.log("[loginWithPin] Session recorded in DB");
      } catch (e) {
        console.warn("[loginWithPin] session record failed:", e);
      }
    }

    // Redirect based on userType
    const redirect =
      userType === "merchant"
        ? "/merchant/dashboard"
        : userType === "customer"
          ? "/customer/dashboard"
          : "/select-role";

    console.log("[loginWithPin] Success, redirecting to", redirect);
    return { success: true, redirect };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[loginWithPin]", msg);
    return { success: false, error: "Failed to create session" };
  }
}

export async function setPin(
  userId: string,
  pin: string
): Promise<{ success: boolean; error?: string }> {
  if (!pin || pin.length < 4 || pin.length > 6) {
    return { success: false, error: "PIN must be 4-6 digits" };
  }
  console.log("[setPin] Setting PIN for user:", userId);

  const admin = getAdminClient();
  if (!admin) return { success: false, error: "Server config" };

  const pinHash = await hashPin(pin);

  // Update both tables (idempotent)
  const queries = [
    (admin.from("merchants") as any)
      .update({ pin_hash: pinHash })
      .eq("id", userId),
    (admin.from("customers") as any)
      .update({ pin_hash: pinHash })
      .eq("id", userId),
  ];

  const results = await Promise.allSettled(queries);
  const errors = results
    .filter((r) => r.status === "rejected")
    .map((r: any) => r.reason);

  if (errors.length > 0) {
    console.error("[setPin] update errors:", errors);
    return { success: false, error: "Failed to save PIN" };
  }

  // Create/refresh session cookie (same as loginWithPin)
  try {
    const cookieStore = await cookies();
    const { token, maxAge } = await createSessionToken(userId);
    cookieStore.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge,
      path: "/",
    });
    console.log("[setPin] Session cookie set for user:", userId);

    // Record session in DB
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
      console.warn("[setPin] session record failed:", e);
    }
  } catch (err) {
    console.error("[setPin] failed to create session cookie:", err);
  }

  return { success: true };
}

export async function changePin(
  merchantId: string,
  currentPin: string,
  newPin: string
): Promise<{ success: boolean; error?: string }> {
  const verified = await verifyPin(merchantId, currentPin);
  if (!verified.success) return verified;

  return setPin(merchantId, newPin);
}

export async function forgotPinSendOtp(
  phone: string
): Promise<{ success: boolean; error?: string }> {
  const { exists } = await checkUserExists(phone);
  if (!exists) {
    return { success: false, error: "No account found with this phone number" };
  }

  // Reuse registration OTP sender
  const { sendRegistrationOtp } = await import("./otp");
  return sendRegistrationOtp(phone);
}

export async function forgotPinVerifyOtp(
  phone: string,
  otp: string,
  newPin: string
): Promise<{ success: boolean; error?: string }> {
  const { verifyRegistrationOtp } = await import("./otp");
  const verified = await verifyRegistrationOtp(phone, otp);
  if (!verified.success) {
    return { success: false, error: verified.error || "Verification failed" };
  }

  if (!verified.userId) {
    return { success: false, error: "Could not identify user" };
  }

  return setPin(verified.userId, newPin);
}
