"use server";

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

  const message = "Welcome to QRHisab! You have been added. Track your ledger and transaction history at qrhisab.com.";

  return sendTransactionSMS(cleanPhone, message);
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
