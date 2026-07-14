"use server";

import { cookies } from "next/headers";
import crypto from "crypto";
import { getAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/phone";
import { createSessionToken, SESSION_COOKIE } from "@/lib/session";
import { sendLoginOtp, verifyLoginOtp } from "./otp";

function hashPin(pin: string): string {
  return crypto.createHash("sha256").update(pin).digest("hex");
}

export async function checkHasPin(
  merchantId: string
): Promise<{ hasPin: boolean }> {
  const admin = getAdminClient();
  if (!admin) return { hasPin: false };

  const { data } = await (admin.from("merchants") as any)
    .select("pin_hash")
    .eq("id", merchantId)
    .maybeSingle();

  return { hasPin: !!data?.pin_hash };
}

export async function verifyPin(
  merchantId: string,
  pin: string
): Promise<{ success: boolean; error?: string }> {
  if (!pin || pin.length < 4 || pin.length > 6) {
    return { success: false, error: "PIN must be 4-6 digits" };
  }

  const admin = getAdminClient();
  if (!admin) return { success: false, error: "Server config" };

  const { data } = await (admin.from("merchants") as any)
    .select("pin_hash")
    .eq("id", merchantId)
    .maybeSingle();

  if (!data?.pin_hash) {
    return { success: false, error: "No PIN set" };
  }

  const hashed = hashPin(pin);
  if (hashed !== data.pin_hash) {
    return { success: false, error: "Incorrect PIN" };
  }

  return { success: true };
}

export async function setPin(
  merchantId: string,
  pin: string
): Promise<{ success: boolean; error?: string }> {
  if (!pin || pin.length < 4 || pin.length > 6) {
    return { success: false, error: "PIN must be 4-6 digits" };
  }

  const admin = getAdminClient();
  if (!admin) return { success: false, error: "Server config" };

  const hashed = hashPin(pin);
  const { error } = await (admin.from("merchants") as any)
    .update({ pin_hash: hashed })
    .eq("id", merchantId);

  if (error) {
    return { success: false, error: "Failed to save PIN" };
  }

  return { success: true };
}

export async function changePin(
  merchantId: string,
  currentPin: string,
  newPin: string
): Promise<{ success: boolean; error?: string }> {
  const verified = await verifyPin(merchantId, currentPin);
  if (!verified.success) {
    return verified;
  }

  return setPin(merchantId, newPin);
}

export async function forgotPinSendOtp(
  phone: string
): Promise<{ success: boolean; error?: string }> {
  const cleanPhone = phone.replace(/\D/g, "").slice(-10);
  if (cleanPhone.length !== 10) {
    return { success: false, error: "Invalid phone number" };
  }

  const admin = getAdminClient();
  if (!admin) return { success: false, error: "Server config" };

  const normalizedPhone = normalizePhone(phone);
  const { data: merchant } = await (admin.from("merchants") as any)
    .select("id")
    .eq("phone", normalizedPhone)
    .maybeSingle();

  if (!merchant) {
    return { success: false, error: "No account found with this phone number" };
  }

  return sendLoginOtp(cleanPhone);
}

export async function forgotPinVerifyOtp(
  phone: string,
  otp: string,
  newPin: string
): Promise<{ success: boolean; error?: string; redirect?: string }> {
  const verified = await verifyLoginOtp(phone, otp, true);
  if (!verified.success) {
    return { success: false, error: verified.error || "Verification failed" };
  }

  if (!verified.userId) {
    return { success: false, error: "Could not identify user" };
  }

  const pinResult = await setPin(verified.userId, newPin);
  if (!pinResult.success) {
    return pinResult;
  }

  return { success: true };
}
