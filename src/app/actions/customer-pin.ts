"use server";

import bcrypt from "bcryptjs";
import { getAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/phone";

const PIN_ROUNDS = 10;

async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, PIN_ROUNDS);
}

export async function checkCustomerHasPin(
  phone: string
): Promise<{ hasPin: boolean; customerId?: string }> {
  const admin = getAdminClient();
  if (!admin) return { hasPin: false };

  const np = normalizePhone(phone);
  const { data } = await (admin.from("customers") as any)
    .select("id, pin_hash")
    .eq("phone", np)
    .maybeSingle();

  return { hasPin: !!data?.pin_hash, customerId: data?.id };
}

export async function verifyCustomerPin(
  phone: string,
  pin: string
): Promise<{ success: boolean; error?: string }> {
  if (!pin || pin.length < 4 || pin.length > 6) {
    return { success: false, error: "PIN must be 4-6 digits" };
  }

  const admin = getAdminClient();
  if (!admin) return { success: false, error: "Server config" };

  const np = normalizePhone(phone);
  const { data } = await (admin.from("customers") as any)
    .select("pin_hash")
    .eq("phone", np)
    .maybeSingle();

  if (!data?.pin_hash) {
    return { success: false, error: "No PIN set" };
  }

  const match = await bcrypt.compare(pin, data.pin_hash);
  if (!match) {
    return { success: false, error: "Incorrect PIN" };
  }

  return { success: true };
}

export async function setCustomerPin(
  phone: string,
  pin: string
): Promise<{ success: boolean; error?: string }> {
  if (!pin || pin.length < 4 || pin.length > 6) {
    return { success: false, error: "PIN must be 4-6 digits" };
  }

  const admin = getAdminClient();
  if (!admin) return { success: false, error: "Server config" };

  const np = normalizePhone(phone);
  const hashed = await hashPin(pin);
  const { error } = await (admin.from("customers") as any)
    .update({ pin_hash: hashed })
    .eq("phone", np);

  if (error) {
    return { success: false, error: "Failed to save PIN" };
  }

  return { success: true };
}
