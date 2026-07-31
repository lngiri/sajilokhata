"use server";

import { cookies } from "next/headers";
import { sendTransactionSMS } from "./sms";
import { getAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/phone";
import { createNotification } from "@/app/actions/notifications";
import type { Database } from "@/lib/types/database";
import { formatNumber } from "@/lib/format";

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

/**
 * Search a merchant's customers by name (or phone prefix) for the manual
 * entry autocomplete. Results are sorted so customers with outstanding dues
 * appear first (most critical first), then by balance, then by name.
 */
export async function searchCustomers(
  merchantId: string,
  query: string
): Promise<{ id: string; name: string | null; phone: string; current_balance: number }[]> {
  const admin = getAdminClient();
  if (!admin) return [];
  const q = query.trim();
  if (q.length < 2) return [];

  try {
    const isNumeric = /^\d+$/.test(q);
    const matchedIds: string[] = [];

    if (isNumeric) {
      // Numeric query: match phone prefix
      const digits = q.replace(/\D/g, "").slice(-10);
      const { data } = await (admin.from("customers") as any)
        .select("id")
        .or(`phone.ilike.${digits}%`);
      for (const r of data || []) {
        if (matchedIds.length >= 10) break;
        matchedIds.push(r.id);
      }
    } else {
      // Text query: match name prefix, then name substring
      const { data: prefix } = await (admin.from("customers") as any)
        .select("id")
        .or(`name.ilike.${q}%`);
      for (const r of prefix || []) {
        matchedIds.push(r.id);
        if (matchedIds.length >= 10) break;
      }
      if (matchedIds.length < 10) {
        const { data: substr } = await (admin.from("customers") as any)
          .select("id")
          .or(`name.ilike.%${q}%`);
        for (const r of substr || []) {
          if (matchedIds.includes(r.id)) continue;
          matchedIds.push(r.id);
          if (matchedIds.length >= 10) break;
        }
      }
    }

    if (matchedIds.length === 0) return [];

    // Keep only customers linked to this merchant
    const { data: mcRows } = await (admin.from("merchant_customers") as any)
      .select("customer_id, customers!inner(id, name, phone)")
      .eq("merchant_id", merchantId)
      .in("customer_id", matchedIds);

    const seen = new Set<string>();
    const rows: any[] = [];
    for (const r of mcRows || []) {
      if (seen.has(r.customer_id)) continue;
      seen.add(r.customer_id);
      rows.push(r);
    }
    if (rows.length === 0) return [];

    const customerIds = rows.map((r: any) => r.customer_id);
    const { data: approvedLogs } = await (admin.from("credit_logs") as any)
      .select("customer_id, amount, type")
      .eq("merchant_id", merchantId)
      .eq("status", "approved")
      .not("type", "in", "('cash','cash_in','expense')")
      .in("customer_id", customerIds);

    const balanceMap: Record<string, number> = {};
    for (const log of approvedLogs || []) {
      const sign = log.type === "debit" ? 1 : -1;
      balanceMap[log.customer_id] = (balanceMap[log.customer_id] || 0) + sign * log.amount;
    }

    return rows
      .map((r: any) => ({
        id: r.customer_id,
        name: r.customers?.name ?? null,
        phone: r.customers?.phone ?? "",
        current_balance: balanceMap[r.customer_id] || 0,
      }))
      .sort((a, b) => {
        const aDue = a.current_balance > 0 ? 1 : 0;
        const bDue = b.current_balance > 0 ? 1 : 0;
        if (aDue !== bDue) return bDue - aDue;
        if (b.current_balance !== a.current_balance) return b.current_balance - a.current_balance;
        return (a.name || "").localeCompare(b.name || "");
      });
  } catch (err) {
    console.warn("[Customer] searchCustomers error:", err);
    return [];
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
  merchantId?: string,
  inviteToken?: string,
  businessName?: string
): Promise<{ success: boolean; error?: string; otp?: string }> {
  const cleanPhone = phone.replace(/\D/g, "").slice(-10);
  if (cleanPhone.length !== 10) {
    return { success: false, error: "Invalid phone" };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://app.qrhisab.com";
  const shopName = businessName || "A shop";
  const inviteLink = `${siteUrl}/register?invite=${inviteToken}`;

  const message = [
    `${shopName} invited you to join Digital Khata.`,
    ``,
    `Complete your registration here:`,
    `${inviteLink}`,
  ].join("\n");

  const result = await sendTransactionSMS(cleanPhone, message);

  return { ...result, otp: "" };
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
): Promise<{
  success: boolean;
  error?: string;
  customer?: { id: string; name: string | null; phone: string };
  smsSent?: boolean;
  smsError?: string;
  smsStatus?: "pending" | "sms_sent" | "sms_failed";
}> {
  const admin = getAdminClient();
  if (!admin) return { success: false, error: "Admin client unavailable" };

  try {
    const normalized = normalizePhone(phone);

    // 1. Look up merchant's business name
    const { data: merchant } = await (admin.from("merchants") as any)
      .select("business_name, name")
      .eq("id", merchantId)
      .single();
    const businessName = merchant?.business_name || merchant?.name || "Shop";

    // 2. Find or create customer
    const { data: rawCustomer } = await admin.from("customers")
      .select("id, name, phone")
      .eq("phone", normalized)
      .maybeSingle();
    let customer = rawCustomer as Pick<CustomerRow, "id" | "name" | "phone"> | null;

    if (!customer) {
      const { data: inserted, error } = await admin.from("customers")
        .insert({ phone: normalized, name: name || null, registration_status: "invited" })
        .select("id, name, phone")
        .single();
      if (error) {
        return { success: false, error: `DB error: ${error.message}` };
      }
      customer = inserted as Pick<CustomerRow, "id" | "name" | "phone">;
    }

    // 3. Link to merchant
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
        return { success: false, error: `Link error: ${error.message}` };
      }
    }

    // 4. Check for existing active invite (duplicate protection)
    const { data: rawExistingInvite } = await (admin.from("customer_invites") as any)
      .select("id, status, resend_count, last_resent_at, expires_at")
      .eq("phone", normalized)
      .eq("merchant_id", merchantId)
      .is("used_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const existingInvite = rawExistingInvite as {
      id: string;
      status: string;
      resend_count: number;
      last_resent_at: string | null;
      expires_at: string;
    } | null;

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    let inviteId: string;

    if (existingInvite) {
      const activeStatuses = ["pending", "sms_sent"];
      if (activeStatuses.includes(existingInvite.status)) {
        return { success: false, error: "Invitation already sent. Waiting for customer registration." };
      }

      const retryableStatuses = ["sms_failed", "expired", "cancelled"];
      if (retryableStatuses.includes(existingInvite.status)) {
        // Check resend limits
        if (existingInvite.resend_count >= 3) {
          return { success: false, error: "Maximum resend attempts reached. Invitation expired." };
        }
        if (existingInvite.last_resent_at) {
          const elapsed = Date.now() - new Date(existingInvite.last_resent_at).getTime();
          if (elapsed < 5 * 60 * 1000) {
            const remaining = Math.ceil((5 * 60 * 1000 - elapsed) / 60000);
            return { success: false, error: `Please wait ${remaining} minute(s) before resending.` };
          }
        }
        // Reuse existing invite — update OTP, reset status
        inviteId = existingInvite.id;
        await (admin.from("customer_invites") as any)
          .update({
            otp,
            expires_at: expiresAt,
            status: "awaiting_confirmation",
            used_at: null,
            sms_sent_at: null,
            sms_error: null,
            last_resent_at: new Date().toISOString(),
            resend_count: existingInvite.resend_count + 1,
          })
          .eq("id", inviteId);
      } else {
        // Status not retryable (otp_verified, registration_completed) — shouldn't reach here
        return { success: false, error: "This invitation is already being processed." };
      }
    } else {
      // 5. Create new invite (id serves as external-facing invite token)
      const { data: insertedInvite, error: inviteError } = await (admin.from("customer_invites") as any)
        .insert({
          customer_id: customer.id,
          merchant_id: merchantId,
          phone: normalized,
          otp,
          expires_at: expiresAt,
          status: "awaiting_confirmation",
        })
        .select("id")
        .single();
      if (inviteError) {
        return { success: false, error: `Invite error: ${inviteError.message}` };
      }
      inviteId = insertedInvite.id;
    }

    // 6. Send SMS
    let smsSent = false;
    let smsError: string | undefined;
    let smsStatus: "pending" | "sms_sent" | "sms_failed" = "pending";

    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://app.qrhisab.com";
      const inviteLink = `${siteUrl}/register?invite=${inviteId}`;
      const message = [
        `${businessName} invited you to join Digital Khata.`,
        ``,
        `Complete your registration here:`,
        `${inviteLink}`,
      ].join("\n");

      const smsResult = await sendTransactionSMS(normalized, message, merchantId);

      if (smsResult.success) {
        smsSent = true;
        smsStatus = "sms_sent";
        await (admin.from("customer_invites") as any)
          .update({
            status: "sms_sent",
            sms_sent_at: new Date().toISOString(),
            sms_error: null,
          })
          .eq("id", inviteId);
      } else {
        smsError = smsResult.error;
        smsStatus = "sms_failed";
        await (admin.from("customer_invites") as any)
          .update({
            status: "sms_failed",
            sms_error: smsResult.error,
          })
          .eq("id", inviteId);
      }
    } catch (err) {
      smsError = err instanceof Error ? err.message : "SMS delivery failed";
      smsStatus = "sms_failed";
      await (admin.from("customer_invites") as any)
        .update({
          status: "sms_failed",
          sms_error: smsError,
        })
        .eq("id", inviteId);
    }

    // 7. Merchant notification
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
      smsStatus,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

export async function getCustomerProfile(
  phone: string
): Promise<{ id: string; name: string | null; phone: string; address: string } | null> {
  const admin = getAdminClient();
  if (!admin) return null;

  const normalized = normalizePhone(phone);
  const { data } = await admin.from("customers")
    .select("id, name, phone, address")
    .eq("phone", normalized)
    .maybeSingle();

  const profile = data as Pick<CustomerRow, "id" | "name" | "phone" | "address"> | null;
  if (!profile) return null;
  return { ...profile, address: profile.address || "" };
}

// ============================================================
// Cookie-validated customer identity helper
// Every transaction-history server action calls this first.
// The browser-supplied customerPhone parameter is NEVER used
// for identity — only the customer_session cookie.
// ============================================================

import { verifyCustomerSessionToken } from "@/lib/session";

async function getAuthenticatedCustomer(): Promise<
  | { id: string; name: string | null; phone: string }
  | null
> {
  try {
    const cookieStore = await cookies();
    const rawCookie = cookieStore.get("customer_session")?.value;
    if (!rawCookie) return null;

    const session = await verifyCustomerSessionToken(rawCookie);
    if (!session?.phone || String(session.phone).replace(/\D/g, "").length < 10) return null;

    const admin = getAdminClient();
    if (!admin) return null;

    const normalized = normalizePhone(session.phone);
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

/**
 * Resolve the authenticated customer from the cookie, creating the
 * customers row if it doesn't exist yet. Scan/walk-up customers only
 * have a session cookie until their first submission, so read-only
 * lookups (getAuthenticatedCustomer) must NOT be used for writes.
 */
async function resolveAuthenticatedCustomer(): Promise<
  | { id: string; name: string | null; phone: string }
  | null
> {
  try {
    const cookieStore = await cookies();
    const rawCookie = cookieStore.get("customer_session")?.value;
    if (!rawCookie) return null;

    const session = await verifyCustomerSessionToken(rawCookie);
    if (!session?.phone || String(session.phone).replace(/\D/g, "").length < 10) return null;

    const admin = getAdminClient();
    if (!admin) return null;

    const normalized = normalizePhone(session.phone);

    const { data: existing } = await (admin
      .from("customers")
      .select("id, name, phone")
      .eq("phone", normalized)
      .maybeSingle() as unknown as Promise<{
      data: Pick<CustomerRow, "id" | "name" | "phone"> | null;
      error: any;
    }>);

    if (existing) return existing;

    const { data: inserted, error } = await (admin.from("customers") as any)
      .insert({ phone: normalized, name: session.name || null })
      .select("id, name, phone")
      .single();

    if (error) {
      // Race: another request created the row first (unique phone) — re-select.
      if (String(error.code).startsWith("23")) {
        const { data: retry } = await (admin
          .from("customers")
          .select("id, name, phone")
          .eq("phone", normalized)
          .maybeSingle() as unknown as Promise<{
          data: Pick<CustomerRow, "id" | "name" | "phone"> | null;
          error: any;
        }>);
        if (retry) return retry;
      }
      console.warn("[Customer] resolveAuthenticatedCustomer insert error:", error);
      return null;
    }

    return inserted as Pick<CustomerRow, "id" | "name" | "phone">;
  } catch (err) {
    console.warn("[Customer] resolveAuthenticatedCustomer error:", err);
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
 * Get transaction-status counts for the authenticated customer.
 * Uses a lightweight status-only query so tab badges reflect the
 * true totals, independent of pagination.
 * @param merchantId Optional — restrict counts to a single shop.
 */
export async function getCustomerLogCounts(merchantId?: string): Promise<{
  total: number;
  awaiting_confirmation: number;
  approved: number;
  rejected: number;
  disputed: number;
}> {
  const empty = { total: 0, awaiting_confirmation: 0, approved: 0, rejected: 0, disputed: 0 };
  const customer = await getAuthenticatedCustomer();
  if (!customer) return empty;

  const admin = getAdminClient();
  if (!admin) return empty;

  let query = admin
    .from("credit_logs")
    .select("status")
    .eq("customer_id", customer.id);
  if (merchantId) {
    query = query.eq("merchant_id", merchantId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const counts = { ...empty };
  for (const row of (data as unknown as { status: string }[]) || []) {
    counts.total++;
    if (row.status === "awaiting_confirmation") counts.awaiting_confirmation++;
    else if (row.status === "approved") counts.approved++;
    else if (row.status === "rejected") counts.rejected++;
    else if (row.status === "disputed") counts.disputed++;
  }
  return counts;
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
      .not("type", "in", '("cash","cash_in")')
      .not("status", "in", '("rejected","disputed")') as unknown as Promise<{
      data: any[] | null;
    }>,
    admin
      .from("credit_logs")
      .select("id")
      .in("customer_id", customerIds)
      .eq("status", "awaiting_confirmation") as unknown as Promise<{
      data: any[] | null;
    }>,
  ]);

  if (relError) throw relError;

  const balanceByMerchant: Record<string, number> = {};
  for (const log of balanceLogs || []) {
    if (
      log.status === "approved" ||
      (log.status === "awaiting_confirmation" &&
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
    .eq("status", "awaiting_confirmation")
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
    .eq("status", "awaiting_confirmation")
    .select()
    .single();

  if (error) throw error;

  if (data?.merchant_id) {
    createNotification({
      userId: data.merchant_id,
      userType: "merchant",
      type: "entry_rejected",
      title: `Entry cancelled by ${customer.name || "Customer"}`,
      body: `Rs. ${formatNumber(data.amount)} entry cancelled`,
      referenceId: logId,
      referenceType: "credit_log",
    });
  }

  return data;
}

/**
 * Confirm (approve) an awaiting_confirmation credit log entry for the authenticated customer.
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
    .eq("status", "awaiting_confirmation")
    .select()
    .single();

  if (error) throw error;

  if (data?.merchant_id) {
    createNotification({
      userId: data.merchant_id,
      userType: "merchant",
      type: "entry_approved",
      title: `Entry confirmed by ${customer.name || "Customer"}`,
      body: `Rs. ${formatNumber(data.amount)} entry approved`,
      referenceId: logId,
      referenceType: "credit_log",
    });
  }

  return data;
}

/**
 * Dispute an awaiting_confirmation credit log entry for the authenticated customer.
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
    .eq("status", "awaiting_confirmation")
    .select()
    .single();

  if (error) throw error;

  if (data?.merchant_id) {
    createNotification({
      userId: data.merchant_id,
      userType: "merchant",
      type: "entry_disputed",
      title: `Entry disputed by ${customer.name || "Customer"}`,
      body: `Rs. ${formatNumber(data.amount)} entry disputed`,
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
  const customer = await resolveAuthenticatedCustomer();
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

// ──────────────────────────────────────────────
// Customer voucher submission (replaces the 3-call
// browser-side findOrCreateCustomer → linkCustomerToMerchant
// → createCreditLog chain).
// Identity comes from the customer_session cookie — the
// phone param is never trusted for authorization. Status is
// pinned to "awaiting_confirmation" and the insert is built
// from an explicit column list, so arbitrary fields (e.g. a
// forged "approved") cannot be injected.
// ──────────────────────────────────────────────

/**
 * Ensure a merchant_customers link exists (idempotent).
 */
async function ensureMerchantCustomerLink(
  merchantId: string,
  customerId: string,
  creditLimit = 5000
): Promise<void> {
  const admin = getAdminClient();
  if (!admin) return;

  const { data: existing } = await (admin.from("merchant_customers") as any)
    .select("id")
    .eq("merchant_id", merchantId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (existing) return;

  await (admin.from("merchant_customers") as any)
    .insert({ merchant_id: merchantId, customer_id: customerId, credit_limit: creditLimit });
}

export async function submitCustomerEntry(params: {
  merchant_id: string;
  phone: string;
  name?: string | null;
  amount: number;
  description?: string | null;
  type: "debit" | "credit";
  idempotency_key?: string;
}): Promise<{
  success: boolean;
  error?: string;
  entry?: { id: string; status: string };
}> {
  try {
    if (!params.merchant_id) {
      return { success: false, error: "Shop information is missing. Please scan the shop QR again." };
    }
    if (!params.amount || typeof params.amount !== "number" || params.amount <= 0) {
      return { success: false, error: "Please enter a valid amount." };
    }
    if (!["debit", "credit"].includes(params.type)) {
      return { success: false, error: "Invalid transaction type." };
    }

    const admin = getAdminClient();
    if (!admin) return { success: false, error: "Database connection unavailable" };

    // Verify the shop actually exists so entries can't target random IDs.
    const { data: merchant } = await (admin.from("merchants") as any)
      .select("id, name")
      .eq("id", params.merchant_id)
      .maybeSingle();
    if (!merchant) {
      return { success: false, error: "Shop not found. Please scan the shop QR again." };
    }

    // Identity always comes from the cookie — never from the params.
    // find-or-create: scan/walk-up customers may not have a customers row yet.
    const customer = await resolveAuthenticatedCustomer();
    if (!customer) return { success: false, error: "Not logged in" };

    await ensureMerchantCustomerLink(params.merchant_id, customer.id);

    // Idempotency: one idempotency key per draft prevents double-submit duplicates.
    if (params.idempotency_key) {
      const { data: existing } = await (admin.from("credit_logs") as any)
        .select("id, status")
        .eq("merchant_id", params.merchant_id)
        .eq("customer_id", customer.id)
        .eq("idempotency_key", params.idempotency_key)
        .maybeSingle();
      if (existing) {
        return { success: true, entry: { id: existing.id, status: existing.status } };
      }
    }

    // Only include idempotency_key when provided — avoids a 42703 crash on
    // production DBs where the column has not been deployed yet (migration 043).
    const insertData: Record<string, unknown> = {
      merchant_id: params.merchant_id,
      customer_id: customer.id,
      amount: params.amount,
      type: params.type,
      description: params.description || null,
      status: "awaiting_confirmation",
      approved_at: null,
      sync_status: "online",
      initiated_by: "customer",
    };
    if (params.idempotency_key) {
      insertData.idempotency_key = params.idempotency_key;
    }

    const { data, error } = await (admin.from("credit_logs") as any)
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("[Customer] submitCustomerEntry insert error:", error);
      return {
        success: false,
        error: `Database error (${error.code || "unknown"}): ${error.message}`,
      };
    }

    createNotification({
      userId: params.merchant_id,
      userType: "merchant",
      type: "entry_created",
      title: `New entry from ${customer.name || customer.phone}`,
      body: `Rs. ${formatNumber(params.amount)} ${params.type === "debit" ? "credit" : "payment"} requested`,
      referenceId: data.id,
      referenceType: "credit_log",
    });

    return { success: true, entry: { id: data.id, status: data.status } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Customer] submitCustomerEntry error:", msg);
    return { success: false, error: msg };
  }
}
