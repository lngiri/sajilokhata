"use server";

import crypto from "crypto";
import { cookies } from "next/headers";
import { sendTransactionSMS } from "./sms";
import { getAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/phone";

/**
 * Lookup a customer by phone number.
 * Returns the existing record if found, or null if the number is available.
 * Used by the Smart Customer Onboarding flow.
 */
export async function checkCustomerByPhone(
  phone: string
): Promise<{ exists: boolean; customer?: { id: string; name: string | null; phone: string } }> {
  try {
    const admin = getAdminClient();
    if (!admin) return { exists: false };

    const normalized = normalizePhone(phone);
    const { data } = await (admin.from("customers") as any)
      .select("id, name, phone")
      .eq("phone", normalized)
      .maybeSingle();

    if (data) {
      return { exists: true, customer: { id: data.id, name: data.name, phone: data.phone } };
    }
    return { exists: false };
  } catch (err) {
    console.warn("[Customer] checkCustomerByPhone error:", err);
    return { exists: false };
  }
}

export async function checkCustomerOnboarded(
  phone: string
): Promise<{ onboarded: boolean }> {
  const normalized = normalizePhone(phone);
  const admin = getAdminClient();
  if (!admin) return { onboarded: false };

  try {
    // Check if a Supabase Auth user exists with this phone
    const { data: users } = await admin.auth.admin.listUsers({
      perPage: 10000,
    });
    const found = users?.users?.find((u: any) => u.phone === normalized);
    return { onboarded: !!found };
  } catch (err) {
    console.warn("[Customer] checkOnboarded error:", err);
    return { onboarded: false };
  }
}

export async function sendOnboardingSMS(
  phone: string,
  _customerName?: string
): Promise<{ success: boolean; error?: string }> {
  const cleanPhone = phone.replace(/\D/g, "").slice(-10);
  if (cleanPhone.length !== 10) {
    return { success: false, error: "Invalid phone" };
  }

  const message = "Welcome to QR Hisab! You have been added. Track your ledger and transaction history at qrhisab.com.";

  return sendTransactionSMS(cleanPhone, message);
}

export async function updateCustomerProfile(
  phone: string,
  data: { name: string }
): Promise<{ success: boolean; error?: string }> {
  const admin = getAdminClient();
  if (!admin) return { success: false, error: "Server config" };

  const name = data.name?.trim();
  if (!name) return { success: false, error: "Name cannot be empty" };

  try {
    const normalized = normalizePhone(phone);
    const { data: customer } = await (admin.from("customers") as any)
      .select("id")
      .eq("phone", normalized)
      .maybeSingle();

    if (!customer) return { success: false, error: "Customer not found" };

    const { error } = await (admin.from("customers") as any)
      .update({ name })
      .eq("id", customer.id);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

export async function addCustomerForMerchant(
  merchantId: string,
  phone: string,
  name?: string
): Promise<{ success: boolean; error?: string; customer?: { id: string; name: string | null; phone: string } }> {
  const admin = getAdminClient();
  if (!admin) return { success: false, error: "Admin client unavailable" };

  try {
    const normalized = normalizePhone(phone);

    // Find or create customer
    let { data: customer } = await (admin.from("customers") as any)
      .select("id, name, phone")
      .eq("phone", normalized)
      .maybeSingle();

    if (!customer) {
      const { data: inserted, error } = await (admin.from("customers") as any)
        .insert({ phone: normalized, name: name || null })
        .select("id, name, phone")
        .single();
      if (error) {
        console.error("[Customer] addCustomerForMerchant insert error:", error);
        return { success: false, error: `DB error: ${error.message}` };
      }
      customer = inserted;

      // Non-blocking onboarding SMS — fire-and-forget, don't block the response
      sendOnboardingSMS(normalized, name).catch(() => {});
    }

    // Link to merchant
    const { data: existing } = await (admin.from("merchant_customers") as any)
      .select("id")
      .eq("merchant_id", merchantId)
      .eq("customer_id", customer.id)
      .maybeSingle();

    if (!existing) {
      const { error } = await (admin.from("merchant_customers") as any)
        .insert({ merchant_id: merchantId, customer_id: customer.id, credit_limit: 5000 });
      if (error) {
        console.error("[Customer] addCustomerForMerchant link error:", error);
        return { success: false, error: `Link error: ${error.message}` };
      }
    }

    return { success: true, customer: { id: customer.id, name: customer.name, phone: normalized } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Customer] addCustomerForMerchant error:", msg);
    return { success: false, error: msg };
  }
}

export async function getCustomerProfile(
  phone: string
): Promise<{ id: string; name: string | null; phone: string; avatar_url: string | null } | null> {
  const admin = getAdminClient();
  if (!admin) return null;

  const normalized = normalizePhone(phone);
  const { data } = await (admin.from("customers") as any)
    .select("id, name, phone, avatar_url")
    .eq("phone", normalized)
    .maybeSingle();

  return data || null;
}

export async function updateCustomerAvatar(
  phone: string,
  avatarBase64: string
): Promise<{ success: boolean; error?: string; avatarUrl?: string }> {
  const admin = getAdminClient();
  if (!admin) return { success: false, error: "Server config" };

  try {
    const normalized = normalizePhone(phone);
    const { data: customer } = await (admin.from("customers") as any)
      .select("id")
      .eq("phone", normalized)
      .maybeSingle();

    if (!customer) return { success: false, error: "Customer not found" };

    const matches = avatarBase64.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!matches) return { success: false, error: "Invalid image data" };

    const mimeType = matches[1];
    const ext = mimeType.split("/")[1];
    const buffer = Buffer.from(matches[2], "base64");
    const fileName = `customer-avatars/${customer.id}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await (admin.storage
      .from("app_assets") as any).upload(fileName, buffer, {
      contentType: mimeType,
      upsert: false,
    });

    if (uploadError) {
      console.error("[Customer] Avatar upload failed:", uploadError);
      return { success: false, error: "Failed to upload avatar" };
    }

    const { data: urlData } = await (admin.storage
      .from("app_assets") as any).getPublicUrl(fileName);
    const publicUrl = urlData?.publicUrl || fileName;

    const { error: updateError } = await (admin.from("customers") as any)
      .update({ avatar_url: publicUrl })
      .eq("id", customer.id);

    if (updateError) {
      console.error("[Customer] Avatar DB update failed:", updateError);
      return { success: false, error: "Failed to save avatar URL" };
    }

    return { success: true, avatarUrl: publicUrl };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Customer] updateCustomerAvatar error:", msg);
    return { success: false, error: msg };
  }
}

/**
 * Server-validated customer credit log submission.
 * Reads the customer_session cookie to extract the verified phone number —
 * never trusts the raw client-provided phone param alone.
 */
export async function submitCustomerEntry(
  merchantId: string,
  amount: number,
  type: "debit" | "credit",
  description?: string | null
): Promise<{ success: boolean; error?: string; logId?: string }> {
  const admin = getAdminClient();
  if (!admin) return { success: false, error: "Server config" };

  try {
    // Read the verified phone from the httpOnly customer_session cookie
    const cookieStore = await cookies();
    const rawCookie = cookieStore.get("customer_session")?.value;
    if (!rawCookie) {
      return { success: false, error: "No session — please scan a QR code first" };
    }

    let session: { phone?: string; name?: string };
    try {
      session = JSON.parse(decodeURIComponent(rawCookie));
    } catch {
      return { success: false, error: "Invalid session data" };
    }

    const phone = session.phone;
    if (!phone || String(phone).replace(/\D/g, "").length < 10) {
      return { success: false, error: "Invalid session — missing phone" };
    }

    const normalized = normalizePhone(phone);

    // Find or create customer
    let customerId: string;
    const { data: existing } = await (admin.from("customers") as any)
      .select("id")
      .eq("phone", normalized)
      .maybeSingle();

    if (existing) {
      customerId = existing.id;
    } else {
      const { data: inserted, error: insertErr } = await (admin.from("customers") as any)
        .insert({ phone: normalized, name: session.name || null })
        .select("id")
        .single();
      if (insertErr) {
        return { success: false, error: "Failed to create customer" };
      }
      customerId = inserted.id;
    }

    // Link to merchant if not already linked
    const { data: link } = await (admin.from("merchant_customers") as any)
      .select("id")
      .eq("merchant_id", merchantId)
      .eq("customer_id", customerId)
      .maybeSingle();

    if (!link) {
      const { error: linkErr } = await (admin.from("merchant_customers") as any)
        .insert({ merchant_id: merchantId, customer_id: customerId, credit_limit: 5000 });
      if (linkErr) {
        return { success: false, error: "Failed to link to merchant" };
      }
    }

    // Create the credit log
    const { data: log, error: logErr } = await (admin.from("credit_logs") as any)
      .insert({
        merchant_id: merchantId,
        customer_id: customerId,
        amount,
        type,
        description: description || null,
        status: "pending",
        sync_status: "online",
        initiated_by: "customer",
      })
      .select("id")
      .single();

    if (logErr) {
      return { success: false, error: "Failed to create entry" };
    }

    return { success: true, logId: log.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Customer] submitCustomerEntry error:", msg);
    return { success: false, error: msg };
  }
}
