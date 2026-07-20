"use server";

import { cookies, headers } from "next/headers";
import bcrypt from "bcryptjs";
import { getAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/phone";
import { createSessionToken, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/session";

const PIN_ROUNDS = 10;

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, PIN_ROUNDS);
}

/**
 * Find a user by phone in both merchants and customers tables.
 * Returns the user record(s) found.
 */
export async function findUserByPhone(phone: string): Promise<{
  merchant?: { id: string; pin_hash: string | null; name: string | null };
  customer?: { id: string; pin_hash: string | null; name: string | null };
}> {
  const admin = getAdminClient();
  if (!admin) return {};

  const np = normalizePhone(phone);
  const [mRes, cRes] = await Promise.all([
    (admin.from("merchants") as any)
      .select("id, pin_hash, name")
      .eq("phone", np)
      .maybeSingle(),
    (admin.from("customers") as any)
      .select("id, pin_hash, name")
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
  name?: string;
}

/**
 * Check if a phone number belongs to an existing user and whether they have a PIN.
 */
export async function checkUserExists(phone: string): Promise<{
  exists: boolean;
  users: UserInfo[];
}> {
  console.log("[checkUserExists] Looking up phone:", phone);
  try {
    const { merchant, customer } = await findUserByPhone(phone);
    const users: UserInfo[] = [];

    if (merchant) {
      users.push({
        userId: merchant.id,
        hasPin: !!merchant.pin_hash,
        userType: "merchant",
        name: merchant.name || undefined,
      });
    }
    if (customer) {
      // If same ID as merchant → already added as 'both'
      const existing = users.find((u) => u.userId === customer.id);
      if (existing) {
        existing.userType = "both";
        existing.hasPin = existing.hasPin || !!customer.pin_hash;
        if (!existing.name) {
          existing.name = customer.name || undefined;
        }
      } else {
        users.push({
          userId: customer.id,
          hasPin: !!customer.pin_hash,
          userType: "customer",
          name: customer.name || undefined,
        });
      }
    }

    console.log("[checkUserExists] Result:", { exists: users.length > 0, users });
    return { exists: users.length > 0, users };
  } catch (e: any) {
    const errorDetail = {
      name: e?.name,
      message: e?.message,
      stack: e?.stack?.split('\n').slice(0, 3).join('\n'),
      phone,
      timestamp: new Date().toISOString(),
    };
    console.error("[checkUserExists] Error:", JSON.stringify(errorDetail, null, 2));
    throw e;
  }
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
    cookieStore.set(SESSION_COOKIE, token, { ...SESSION_COOKIE_OPTIONS, maxAge });
    console.log("[loginWithPin] Session cookie set for user:", userId, "| maxAge:", maxAge, "| token length:", token.length);
    const verifyCookie = cookieStore.get(SESSION_COOKIE)?.value;
    console.log("[loginWithPin] Post-set cookie check:", !!verifyCookie, "| matches:", verifyCookie === token);

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
    cookieStore.set(SESSION_COOKIE, token, { ...SESSION_COOKIE_OPTIONS, maxAge });
    console.log("[setPin] Session cookie set for user:", userId, "| maxAge:", maxAge, "| token length:", token.length);

    // Verify cookie was written by reading it back
    const verifyCookie = cookieStore.get(SESSION_COOKIE)?.value;
    console.log("[setPin] Post-set cookie check:", !!verifyCookie, "| matches:", verifyCookie === token);

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

/**
 * Register a NEW user with the chosen role.
 * Creates the user row and sets the session cookie.
 * Called AFTER role selection (not within OTP verification).
 */
export async function registerNewUser(
  phone: string,
  role: "merchant" | "customer",
  name?: string
): Promise<{ success: boolean; error?: string; userId?: string; phone?: string; userType?: string }> {
  console.log("[registerNewUser] Registering new", role, "with phone:", phone, "name:", name);

  try {
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    const normalizedPhone = normalizePhone(cleanPhone);
    const admin = getAdminClient();

    // Duplicate phone guard — check both tables before creating
    if (admin) {
      const { merchant: existingMerchant, customer: existingCustomer } = await findUserByPhone(normalizedPhone);
      if (existingMerchant || existingCustomer) {
        return { success: false, error: "यो फोन नम्बरबाट पहिले नै खाता बनिसकेको छ।" };
      }
    }

    if (!admin) {
      // Dev mode fallback
      const localId = `local_${cleanPhone}`;
      const cookieStore = await cookies();
      const { token, maxAge } = await createSessionToken(localId);
      cookieStore.set(SESSION_COOKIE, token, { ...SESSION_COOKIE_OPTIONS, maxAge });
      return { success: true, userId: localId, phone: cleanPhone, userType: role };
    }

    const userId = crypto.randomUUID();

    if (role === "merchant") {
      const { error: upsertError } = await (admin.from("merchants") as any).upsert(
        {
          id: userId,
          phone: normalizedPhone,
          name: name || "Shop",
          business_type: "kirana",
          sms_balance: 10,
        },
        { onConflict: "id" }
      );
      if (upsertError) {
        console.error("[registerNewUser] Failed to create merchant:", upsertError);
        return { success: false, error: "Could not create account. Please try again." };
      }
    } else {
      const { error: insertError } = await (admin.from("customers") as any).insert({
        id: userId,
        phone: normalizedPhone,
        name: name || "Customer",
      });
      if (insertError) {
        console.error("[registerNewUser] Failed to create customer:", insertError);
        return { success: false, error: "Could not create account. Please try again." };
      }
    }

    // Set session cookie
    const cookieStore = await cookies();
    const { token, maxAge } = await createSessionToken(userId);
    cookieStore.set(SESSION_COOKIE, token, { ...SESSION_COOKIE_OPTIONS, maxAge });
    console.log("[registerNewUser] Session cookie set for", role, "userId:", userId);

    // Verify cookie was written
    const verifyCookie = cookieStore.get(SESSION_COOKIE)?.value;
    console.log("[registerNewUser] Post-set cookie check:", !!verifyCookie, "| matches:", verifyCookie === token);

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
      console.warn("[registerNewUser] Session record failed:", e);
    }

    return { success: true, userId, phone: cleanPhone, userType: role };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[registerNewUser] Error:", msg);
    return { success: false, error: "Internal error. Please try again." };
  }
}

export async function forgotPinVerifyOtp(
  phone: string,
  otp: string,
  newPin: string
): Promise<{ success: boolean; error?: string; redirect?: string; userId?: string }> {
  console.log("[forgotPinVerifyOtp] Starting for phone:", phone);
  const { verifyRegistrationOtp } = await import("./otp");
  const verified = await verifyRegistrationOtp(phone, otp);
  if (!verified.success) {
    console.log("[forgotPinVerifyOtp] OTP verify failed:", verified.error);
    return { success: false, error: verified.error || "Verification failed" };
  }

  if (!verified.exists || !verified.userId) {
    console.log("[forgotPinVerifyOtp] No existing user — cannot reset PIN");
    return { success: false, error: "No account found with this phone number" };
  }

  console.log("[forgotPinVerifyOtp] Setting new PIN for user:", verified.userId, "type:", verified.userType);
  const pinResult = await setPin(verified.userId, newPin);
  if (!pinResult.success) return pinResult;

  const redirect =
    verified.userType === "merchant"
      ? "/merchant/dashboard"
      : verified.userType === "customer"
        ? "/customer/dashboard"
        : "/select-role";

  return { success: true, redirect, userId: verified.userId };
}
