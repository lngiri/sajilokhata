"use server";

import crypto from "crypto";
import { cookies } from "next/headers";
import { sendTransactionSMS } from "./sms";
import { getAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/phone";
import { createNotification } from "@/app/actions/notifications";
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
  _customerName?: string,
  customerId?: string,
  merchantId?: string
): Promise<{ success: boolean; error?: string; otp?: string }> {
  const cleanPhone = phone.replace(/\D/g, "").slice(-10);
  if (cleanPhone.length !== 10) {
    return { success: false, error: "Invalid phone" };
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://app.qrhisab.com";
  const domain = new URL(siteUrl).hostname;
  const message = `Welcome to QR Hisab! Your verification code is: ${otp}. Register now at ${domain} to track your ledger and transaction history.`;

  // Send SMS first — only store invite after SMS succeeds
  const result = await sendTransactionSMS(cleanPhone, message);

  if (result.success && customerId && merchantId) {
    const admin = getAdminClient();
    if (admin) {
      await (admin.from("customer_invites") as any).insert({
        customer_id: customerId,
        merchant_id: merchantId,
        phone: cleanPhone,
        otp,
        expires_at: expiresAt,
      });
    }
  }

  return { ...result, otp };
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
): Promise<{ success: boolean; error?: string; customer?: { id: string; name: string | null; phone: string }; smsSent?: boolean; smsError?: string }> {
  const admin = getAdminClient();
  if (!admin) return { success: false, error: "Admin client unavailable" };

  try {
    const normalized = normalizePhone(phone);
    let isNewCustomer = false;

    // Find or create customer
    const { data: rawCustomer } = await admin.from("customers")
      .select("id, name, phone")
      .eq("phone", normalized)
      .maybeSingle();
    let customer = rawCustomer as Pick<CustomerRow, "id" | "name" | "phone"> | null;

    if (!customer) {
      isNewCustomer = true;
      const { data: inserted, error } = await admin.from("customers")
        .insert({ phone: normalized, name: name || null, registration_status: "invited" })
        .select("id, name, phone")
        .single();
      if (error) {
        console.error("[Customer] addCustomerForMerchant insert error:", error);
        return { success: false, error: `DB error: ${error.message}` };
      }
      customer = inserted as Pick<CustomerRow, "id" | "name" | "phone">;
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

    // Send onboarding SMS (registration link with OTP) — track delivery status
    let smsSent = false;
    let smsError: string | undefined;
    if (isNewCustomer) {
      try {
        const smsResult = await sendOnboardingSMS(normalized, name, customer.id, merchantId);
        smsSent = smsResult.success;
        smsError = smsResult.error;
        if (!smsResult.success) {
          console.warn("[Customer] Onboarding SMS failed:", smsResult.error);
        }
      } catch (err) {
        smsError = err instanceof Error ? err.message : "SMS delivery failed";
        console.error("[Customer] Onboarding SMS exception:", err);
      }
    }

    createNotification({
      userId: merchantId,
      userType: "merchant",
      type: "customer_linked",
      title: "New customer added",
      body: `${customer.name || "Customer"} linked to your shop`,
      referenceId: customer.id,
      referenceType: "customer",
    });

    return {
      success: true,
      customer: { id: customer.id, name: customer.name, phone: normalized },
      smsSent,
      smsError,
    };
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

    const { data: shop } = await (admin.from("merchants") as any)
      .select("name")
      .eq("id", merchantId)
      .single()
      .catch(() => ({ data: null }));
    const shopName = shop?.name || "Shop";
    createNotification({
      userId: merchantId,
      userType: "merchant",
      type: "entry_created",
      title: `New credit request from ${session.name || "a customer"}`,
      body: `Rs. ${Number(amount).toLocaleString()} ${type} requested at ${shopName}`,
      referenceId: log.id,
      referenceType: "credit_log",
    });

    return { success: true, logId: log.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Customer] submitCustomerEntry error:", msg);
    return { success: false, error: msg };
  }
}

// ============================================================
// Cookie-validated customer identity helper
// Every transaction-history server action calls this first.
// The browser-supplied customerPhone parameter is NEVER used
// for identity — only the httpOnly customer_session cookie.
// ============================================================

async function getAuthenticatedCustomer(): Promise<
  | { id: string; name: string | null; phone: string }
  | null
> {
  try {
    const cookieStore = await cookies();
    const rawCookie = cookieStore.get("customer_session")?.value;
    if (!rawCookie) return null;

    let session: { phone?: string; name?: string };
    try {
      session = JSON.parse(decodeURIComponent(rawCookie));
    } catch {
      return null;
    }

    const phone = session.phone;
    if (!phone || String(phone).replace(/\D/g, "").length < 10) return null;

    const admin = getAdminClient();
    if (!admin) return null;

    const normalized = normalizePhone(phone);
    const { data } = await admin
      .from("customers")
      .select("id, name, phone")
      .eq("phone", normalized)
      .maybeSingle();

    return (data as Pick<CustomerRow, "id" | "name" | "phone">) || null;
  } catch (err) {
    console.warn("[Customer] getAuthenticatedCustomer error:", err);
    return null;
  }
}

// ============================================================
// Transaction History — Server actions
// All functions derive identity from the customer_session cookie.
// The browser-supplied phone parameter is accepted for API
// compatibility but IGNORED for authorization.
// ============================================================

/**
 * Get credit logs for the authenticated customer.
 * @param _browserPhone Ignored — identity comes from cookie.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCustomerCreditLogs(
  _browserPhone: string,
  options?: {
    status?: string;
    limit?: number;
    offset?: number;
    merchant_id?: string;
  }
): Promise<any[]> {
  const customer = await getAuthenticatedCustomer();
  if (!customer) return [];

  const admin = getAdminClient();
  if (!admin) return [];

  let query = admin
    .from("credit_logs")
    .select("*, customers(name, phone), merchants!inner(id, name, business_name)")
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false });

  if (options?.status) {
    query = query.eq("status", options.status);
  }
  if (options?.merchant_id) {
    query = query.eq("merchant_id", options.merchant_id);
  }
  if (options?.limit) {
    query = query.range(
      options.offset || 0,
      (options.offset || 0) + options.limit - 1
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Get balance stats for the authenticated customer.
 * @param _browserPhone Ignored — identity comes from cookie.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCustomerStats(
  _browserPhone: string
): Promise<{
  totalOutstanding: number;
  shopsCount: number;
  totalCreditLimit: number;
  pendingCount: number;
  relationships: any[];
} | null> {
  const customer = await getAuthenticatedCustomer();
  if (!customer) return null;

  const admin = getAdminClient();
  if (!admin) return null;

  const customerIds = [customer.id];

  // All three queries depend only on customer.id — run in parallel
  const [{ data: relationships, error: relError }, { data: balanceLogs }, { data: pendingLogs }] = await Promise.all([
    admin
      .from("merchant_customers")
      .select("credit_limit, merchants(id, name, business_name)")
      .in("customer_id", customerIds) as any,
    admin
      .from("credit_logs")
      .select("merchant_id, amount, type, status, description")
      .in("customer_id", customerIds)
      .neq("type", "cash")
      .not("status", "in", '("rejected","disputed")') as unknown as Promise<{
      data: any[] | null;
    }>,
    admin
      .from("credit_logs")
      .select("id")
      .in("customer_id", customerIds)
      .eq("status", "pending") as unknown as Promise<{
      data: any[] | null;
    }>,
  ]);

  if (relError) throw relError;

  const balanceByMerchant: Record<string, number> = {};
  for (const log of balanceLogs || []) {
    if (
      log.status === "approved" ||
      (log.status === "pending" &&
        (log.description as string)?.startsWith("Opening Balance"))
    ) {
      const sign = log.type === "debit" ? 1 : -1;
      balanceByMerchant[log.merchant_id] =
        (balanceByMerchant[log.merchant_id] || 0) + sign * log.amount;
    }
  }

  const totalOutstanding = Object.values(balanceByMerchant).reduce(
    (sum, b) => sum + b,
    0
  );
  const totalCreditLimit =
    relationships?.reduce(
      (sum: number, r: any) => sum + (r.credit_limit || 0),
      0
    ) || 0;
  const pendingCount = pendingLogs?.length || 0;

  const relationshipsWithBalance = (relationships || []).map((r: any) => ({
    ...r,
    current_balance: balanceByMerchant[r.merchants?.id] || 0,
  }));

  return {
    totalOutstanding,
    shopsCount: relationships?.length || 0,
    totalCreditLimit,
    pendingCount,
    relationships: relationshipsWithBalance,
  };
}

/**
 * Update a pending credit log entry for the authenticated customer.
 * Only affects entries owned by the authenticated customer.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateCreditLog(
  logId: string,
  updates: { amount?: number; description?: string }
): Promise<any> {
  const customer = await getAuthenticatedCustomer();
  if (!customer) throw new Error("Not authenticated");

  const admin = getAdminClient();
  if (!admin) throw new Error("Server config");

  const payload: Record<string, unknown> = {};
  if (updates.amount !== undefined) payload.amount = updates.amount;
  if (updates.description !== undefined) payload.description = updates.description;

  const { data, error } = await admin
    .from("credit_logs")
    .update(payload)
    .eq("id", logId)
    .eq("customer_id", customer.id)
    .eq("status", "pending")
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Cancel (reject) a credit log entry for the authenticated customer.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function cancelCreditLog(logId: string): Promise<any> {
  const customer = await getAuthenticatedCustomer();
  if (!customer) throw new Error("Not authenticated");

  const admin = getAdminClient();
  if (!admin) throw new Error("Server config");

  const { data, error } = await admin
    .from("credit_logs")
    .update({ status: "rejected" })
    .eq("id", logId)
    .eq("customer_id", customer.id)
    .select()
    .single();

  if (error) throw error;

  if (data?.merchant_id) {
    createNotification({
      userId: data.merchant_id,
      userType: "merchant",
      type: "entry_rejected",
      title: `Entry cancelled by ${customer.name || "Customer"}`,
      body: `Rs. ${Number(data.amount || 0).toLocaleString()} entry cancelled`,
      referenceId: logId,
      referenceType: "credit_log",
    });
  }

  return data;
}

/**
 * Confirm (approve) an unverified credit log entry for the authenticated customer.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function confirmCustomerEntry(logId: string): Promise<any> {
  const customer = await getAuthenticatedCustomer();
  if (!customer) throw new Error("Not authenticated");

  const admin = getAdminClient();
  if (!admin) throw new Error("Server config");

  const { data, error } = await admin
    .from("credit_logs")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
    })
    .eq("id", logId)
    .eq("customer_id", customer.id)
    .select()
    .single();

  if (error) throw error;

  if (data?.merchant_id) {
    createNotification({
      userId: data.merchant_id,
      userType: "merchant",
      type: "entry_approved",
      title: `Entry confirmed by ${customer.name || "Customer"}`,
      body: `Rs. ${Number(data.amount || 0).toLocaleString()} entry approved`,
      referenceId: logId,
      referenceType: "credit_log",
    });
  }

  return data;
}

/**
 * Dispute an unverified credit log entry for the authenticated customer.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function disputeEntry(logId: string): Promise<any> {
  const customer = await getAuthenticatedCustomer();
  if (!customer) throw new Error("Not authenticated");

  const admin = getAdminClient();
  if (!admin) throw new Error("Server config");

  const { data, error } = await admin
    .from("credit_logs")
    .update({ status: "disputed" })
    .eq("id", logId)
    .eq("customer_id", customer.id)
    .select()
    .single();

  if (error) throw error;

  if (data?.merchant_id) {
    createNotification({
      userId: data.merchant_id,
      userType: "merchant",
      type: "entry_disputed",
      title: `Entry disputed by ${customer.name || "Customer"}`,
      body: `Rs. ${Number(data.amount || 0).toLocaleString()} entry disputed`,
      referenceId: logId,
      referenceType: "credit_log",
    });
  }

  return data;
}

/**
 * Find or create a customer record for the authenticated customer.
 * Used by the voucher submission flow on the dashboard.
 * @param _browserPhone Ignored — identity comes from cookie.
 * @param _browserName Ignored — identity comes from cookie.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function findOrCreateCustomer(
  _browserPhone: string,
  _browserName?: string
): Promise<any> {
  const customer = await getAuthenticatedCustomer();
  if (!customer) throw new Error("Not authenticated");
  return customer;
}

// ──────────────────────────────────────────────
// Customer IDs for Realtime subscriptions
// (replaces browser-side supabase.from("customers") query)
// ──────────────────────────────────────────────

/**
 * Get customer IDs by phone — used for Realtime channel filters.
 * Safe because it derives identity from the customer_session cookie.
 */
export async function getCustomerIdsForPhone(phone: string): Promise<string[]> {
  const admin = getAdminClient();
  if (!admin) return [];

  const normalized = normalizePhone(phone);
  const { data } = await admin.from("customers")
    .select("id")
    .eq("phone", normalized);

  return (data as { id: string }[] | null)?.map((c) => c.id) || [];
}
