"use server";

import crypto from "crypto";
import { cookies } from "next/headers";
import { sendTransactionSMS } from "./sms";
import { getAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/phone";
import type { Database } from "@/lib/types/database";

type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];
type CustomerInsert = Database["public"]["Tables"]["customers"]["Insert"];
type MerchantCustomerRow = Database["public"]["Tables"]["merchant_customers"]["Row"];
type MerchantCustomerInsert = Database["public"]["Tables"]["merchant_customers"]["Insert"];
type CreditLogRow = Database["public"]["Tables"]["credit_logs"]["Row"];
type CreditLogInsert = Database["public"]["Tables"]["credit_logs"]["Insert"];

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
    const { data } = await admin.from("customers")
      .select("id, name, phone")
      .eq("phone", normalized)
      .maybeSingle();

    const row = data as Pick<CustomerRow, "id" | "name" | "phone"> | null;
    if (row) {
      return { exists: true, customer: { id: row.id, name: row.name, phone: row.phone } };
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

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://app.qrhisab.com";
  const domain = new URL(siteUrl).hostname;
  const message = `Welcome to QR Hisab! You have been added. Track your ledger and transaction history at ${domain}.`;

  return sendTransactionSMS(cleanPhone, message);
}

export async function updateCustomerProfile(
  phone: string,
  data: { name?: string; address?: string }
): Promise<{ success: boolean; error?: string }> {
  const admin = getAdminClient();
  if (!admin) return { success: false, error: "Server config" };

  const name = data.name?.trim();
  const address = data.address?.trim();
  if (!name && !address) return { success: false, error: "Nothing to update" };

  try {
    const normalized = normalizePhone(phone);
    const { data: rawCustomer } = await admin.from("customers")
      .select("id")
      .eq("phone", normalized)
      .maybeSingle();
    const customer = rawCustomer as Pick<CustomerRow, "id"> | null;

    if (!customer) return { success: false, error: "Customer not found" };

    const updatePayload: Record<string, string> = {};
    if (name) updatePayload.name = name;
    if (address) updatePayload.address = address;

    const { error } = await admin.from("customers")
      .update(updatePayload)
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
    const { data: rawCustomer } = await admin.from("customers")
      .select("id, name, phone")
      .eq("phone", normalized)
      .maybeSingle();
    let customer = rawCustomer as Pick<CustomerRow, "id" | "name" | "phone"> | null;

    if (!customer) {
      const { data: inserted, error } = await admin.from("customers")
        .insert({ phone: normalized, name: name || null })
        .select("id, name, phone")
        .single();
      if (error) {
        console.error("[Customer] addCustomerForMerchant insert error:", error);
        return { success: false, error: `DB error: ${error.message}` };
      }
      customer = inserted as Pick<CustomerRow, "id" | "name" | "phone">;

      // Non-blocking onboarding SMS — fire-and-forget, don't block the response
      sendOnboardingSMS(normalized, name).catch(() => {});
    }

    // Link to merchant
    const { data: rawExisting } = await admin.from("merchant_customers")
      .select("id")
      .eq("merchant_id", merchantId)
      .eq("customer_id", customer.id)
      .maybeSingle();
    const existing = rawExisting as Pick<MerchantCustomerRow, "id"> | null;

    if (!existing) {
      const { error } = await admin.from("merchant_customers")
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
): Promise<{ id: string; name: string | null; phone: string; avatar_url: string | null; address: string } | null> {
  const admin = getAdminClient();
  if (!admin) return null;

  const normalized = normalizePhone(phone);
  const { data } = await admin.from("customers")
    .select("id, name, phone, avatar_url, address")
    .eq("phone", normalized)
    .maybeSingle();

  const profile = data as Pick<CustomerRow, "id" | "name" | "phone" | "avatar_url" | "address"> | null;
  if (!profile) return null;
  return { ...profile, address: profile.address || "" };
}

export async function updateCustomerAvatar(
  phone: string,
  avatarBase64: string
): Promise<{ success: boolean; error?: string; avatarUrl?: string }> {
  const admin = getAdminClient();
  if (!admin) return { success: false, error: "Server config" };

  try {
    const normalized = normalizePhone(phone);
    const { data: rawCustomer } = await admin.from("customers")
      .select("id")
      .eq("phone", normalized)
      .maybeSingle();
    const customer = rawCustomer as Pick<CustomerRow, "id"> | null;

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

    const { error: updateError } = await admin.from("customers")
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
    const { data: rawExisting } = await admin.from("customers")
      .select("id")
      .eq("phone", normalized)
      .maybeSingle();
    const existing = rawExisting as Pick<CustomerRow, "id"> | null;

    if (existing) {
      customerId = existing.id;
    } else {
      const { data: inserted, error: insertErr } = await admin.from("customers")
        .insert({ phone: normalized, name: session.name || null })
        .select("id")
        .single();
      if (insertErr) {
        return { success: false, error: "Failed to create customer" };
      }
      customerId = (inserted as Pick<CustomerRow, "id">).id;
    }

    // Link to merchant if not already linked
    const { data: rawLink } = await admin.from("merchant_customers")
      .select("id")
      .eq("merchant_id", merchantId)
      .eq("customer_id", customerId)
      .maybeSingle();
    const link = rawLink as Pick<MerchantCustomerRow, "id"> | null;

    if (!link) {
      const { error: linkErr } = await admin.from("merchant_customers")
        .insert({ merchant_id: merchantId, customer_id: customerId, credit_limit: 5000 });
      if (linkErr) {
        return { success: false, error: "Failed to link to merchant" };
      }
    }

    // Create the credit log
    const { data: rawLog, error: logErr } = await admin.from("credit_logs")
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

    const log = rawLog as Pick<CreditLogRow, "id">;
    return { success: true, logId: log.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Customer] submitCustomerEntry error:", msg);
    return { success: false, error: msg };
  }
}
