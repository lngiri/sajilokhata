"use server";

import { cookies } from "next/headers";
import { getAdminClient } from "@/lib/supabase/admin";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

/**
 * Require a valid merchant session before allowing data access.
 * Returns the verified merchant ID or throws.
 */
async function requireMerchant(): Promise<string> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) throw new Error("Not logged in");

  const userId = await verifySessionToken(raw);
  if (!userId) throw new Error("Session expired");

  return userId;
}

// ──────────────────────────────────────────────
// Profile
// ──────────────────────────────────────────────

export async function getMerchantProfile(merchantId: string, columns = "*") {
  const admin = getAdminClient();
  if (!admin) throw new Error("Server configuration error");

  // Security: verify the requested merchantId matches the session
  const sessionUserId = await requireMerchant().catch(() => null);
  if (!sessionUserId || sessionUserId !== merchantId) {
    throw new Error("Not logged in");
  }

  const { data, error } = await (admin.from("merchants") as any)
    .select(columns)
    .eq("id", merchantId)
    .single();

  if (error) throw error;
  return data;
}

// ──────────────────────────────────────────────
// Stats
// ──────────────────────────────────────────────

export async function getMerchantStats(merchantId: string): Promise<{
  totalOutstanding: number;
  totalCreditLimit: number;
  customerCount: number;
  pendingCount: number;
  todayTotal: number;
  totalCashSales: number;
  totalSales: number;
  cashInHand: number;
}> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Server config");

  const sessionUserId = await requireMerchant().catch(() => null);
  if (!sessionUserId || sessionUserId !== merchantId) {
    throw new Error("Not logged in");
  }

  const { data: customers } = await (admin.from("merchant_customers") as any)
    .select("credit_limit")
    .eq("merchant_id", merchantId);

  const { data: pendingLogs } = await (admin.from("credit_logs") as any)
    .select("id, amount")
    .eq("merchant_id", merchantId)
    .eq("status", "pending");

  const { data: allApprovedLogs } = await (admin.from("credit_logs") as any)
    .select("amount, type, created_at")
    .eq("merchant_id", merchantId)
    .eq("status", "approved");

  const today = new Date().toISOString().split("T")[0];
  const rows = allApprovedLogs || [];
  const balanceLogs = rows.filter((l: any) => l.type !== "cash");
  const cashLogs = rows.filter((l: any) => l.type === "cash");
  const paymentLogs = rows.filter((l: any) => l.type === "credit");

  const totalOutstanding = balanceLogs.reduce((sum: number, l: any) => {
    return sum + (l.type === "debit" ? l.amount : -l.amount);
  }, 0);

  const todayTotal = balanceLogs.reduce((sum: number, l: any) => {
    if (!l.created_at?.startsWith(today)) return sum;
    return sum + (l.type === "debit" ? l.amount : -l.amount);
  }, 0);

  const totalCashSales = cashLogs.reduce((sum: number, l: any) => {
    if (!l.created_at?.startsWith(today)) return sum;
    return sum + l.amount;
  }, 0);

  const todayDebits = balanceLogs.reduce((sum: number, l: any) => {
    if (!l.created_at?.startsWith(today)) return sum;
    return l.type === "debit" ? sum + l.amount : sum;
  }, 0);

  const totalSales = todayDebits + totalCashSales;

  const todayPayments = paymentLogs.reduce((sum: number, l: any) => {
    if (!l.created_at?.startsWith(today)) return sum;
    return sum + l.amount;
  }, 0);
  const cashInHand = totalCashSales + todayPayments;

  const totalCreditLimit = customers?.reduce((sum: number, c: any) => sum + (c.credit_limit || 0), 0) || 0;
  const pendingCount = pendingLogs?.length || 0;

  return {
    totalOutstanding,
    totalCreditLimit,
    customerCount: customers?.length || 0,
    pendingCount,
    todayTotal,
    totalCashSales,
    totalSales,
    cashInHand,
  };
}

// ──────────────────────────────────────────────
// Credit Logs
// ──────────────────────────────────────────────

export async function getMerchantCreditLogs(
  merchantId: string,
  options?: {
    status?: string;
    customerId?: string;
    limit?: number;
    offset?: number;
    dateFrom?: string;
    dateTo?: string;
    columns?: string;
  }
) {
  const admin = getAdminClient();
  if (!admin) throw new Error("Server config");

  const sessionUserId = await requireMerchant().catch(() => null);
  if (!sessionUserId || sessionUserId !== merchantId) {
    throw new Error("Not logged in");
  }

  let query = (admin.from("credit_logs") as any)
    .select(options?.columns || "*, customers(name, phone)")
    .eq("merchant_id", merchantId)
    .order("created_at", { ascending: false });

  if (options?.status) query = query.eq("status", options.status);
  if (options?.customerId) query = query.eq("customer_id", options.customerId);
  if (options?.dateFrom) query = query.gte("created_at", options.dateFrom);
  if (options?.dateTo) query = query.lte("created_at", options.dateTo + "T23:59:59.999Z");
  if (options?.limit) {
    query = query.range(options.offset || 0, (options.offset || 0) + options.limit - 1);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ──────────────────────────────────────────────
// Recent Descriptions
// ──────────────────────────────────────────────

// ──────────────────────────────────────────────
// Analytics
// ──────────────────────────────────────────────

export interface AnalyticsResult {
  totalOutstanding: number;
  totalReceived: number;
  totalCashSales: number;
  totalSales: number;
  cashInHand: number;
  netCashFlow: number;
  topCustomers: { name: string; phone: string; balance: number }[];
  dailyBreakdown: { date: string; debit: number; credit: number; cash: number }[];
}

export async function getMerchantAnalytics(
  merchantId: string,
  dateFrom?: string,
  dateTo?: string
): Promise<AnalyticsResult> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Server config");

  const sessionUserId = await requireMerchant().catch(() => null);
  if (!sessionUserId || sessionUserId !== merchantId) {
    throw new Error("Not logged in");
  }

  let query = (admin.from("credit_logs") as any)
    .select("amount, type, created_at, customers(name, phone)")
    .eq("merchant_id", merchantId)
    .eq("status", "approved")
    .order("created_at", { ascending: true });

  if (dateFrom) query = query.gte("created_at", dateFrom);
  if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59.999Z");

  const { data: logs } = await query;
  const rows = logs || [];

  let totalOutstanding = 0;
  let totalReceived = 0;
  let totalCashSales = 0;
  const customerBal: Record<string, { name: string; phone: string; balance: number }> = {};
  const dailyMap: Record<string, { debit: number; credit: number; cash: number }> = {};

  for (const l of rows) {
    if (l.type === "cash") {
      totalCashSales += l.amount;
    } else if (l.type === "debit") {
      totalOutstanding += l.amount;
    } else {
      totalReceived += l.amount;
    }

    if (l.type !== "cash" && l.customers) {
      const cusKey = l.customers.phone || "unknown";
      if (!customerBal[cusKey]) {
        customerBal[cusKey] = { name: l.customers.name || cusKey, phone: cusKey, balance: 0 };
      }
      customerBal[cusKey].balance += l.type === "debit" ? l.amount : -l.amount;
    }

    const day = l.created_at?.split("T")[0] || "unknown";
    if (!dailyMap[day]) dailyMap[day] = { debit: 0, credit: 0, cash: 0 };
    if (l.type === "debit") dailyMap[day].debit += l.amount;
    else if (l.type === "cash") dailyMap[day].cash += l.amount;
    else dailyMap[day].credit += l.amount;
  }

  const topCustomers = Object.values(customerBal)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 5);

  const totalSales = totalOutstanding + totalCashSales;
  const cashInHand = totalCashSales + totalReceived;

  const dailyBreakdown = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({ date, ...vals }));

  return { totalOutstanding, totalReceived, totalCashSales, totalSales, cashInHand, netCashFlow: totalReceived - totalOutstanding, topCustomers, dailyBreakdown };
}

// ──────────────────────────────────────────────
// Customers
// ──────────────────────────────────────────────

export async function getMerchantCustomers(merchantId: string) {
  const admin = getAdminClient();
  if (!admin) throw new Error("Server config");

  const sessionUserId = await requireMerchant().catch(() => null);
  if (!sessionUserId || sessionUserId !== merchantId) {
    throw new Error("Not logged in");
  }

  const { data } = await (admin.from("merchant_customers") as any)
    .select("*, customers(id, name, phone)")
    .eq("merchant_id", merchantId);

  const rows = data || [];
  if (rows.length === 0) return [];

  const seen = new Set<string>();
  const deduped = rows.filter((r: any) => {
    if (seen.has(r.customer_id)) return false;
    seen.add(r.customer_id);
    return true;
  });

  const customerIds = deduped.map((r: any) => r.customer_id);

  const { data: approvedLogs } = await (admin.from("credit_logs") as any)
    .select("customer_id, amount, type")
    .eq("merchant_id", merchantId)
    .eq("status", "approved")
    .neq("type", "cash")
    .in("customer_id", customerIds);

  const balanceMap: Record<string, number> = {};
  for (const log of approvedLogs || []) {
    const sign = log.type === "debit" ? 1 : -1;
    balanceMap[log.customer_id] = (balanceMap[log.customer_id] || 0) + sign * log.amount;
  }

  return deduped
    .map((r: any) => ({ ...r, current_balance: balanceMap[r.customer_id] || 0 }))
    .sort((a: any, b: any) => b.current_balance - a.current_balance);
}

export async function getMerchantCustomerBalance(merchantId: string, customerId: string): Promise<{ balance: number; creditLimit: number }> {
  const admin = getAdminClient();
  if (!admin) return { balance: 0, creditLimit: 0 };

  const sessionUserId = await requireMerchant().catch(() => null);
  if (!sessionUserId || sessionUserId !== merchantId) {
    return { balance: 0, creditLimit: 0 };
  }

  const { data: mc } = await (admin.from("merchant_customers") as any)
    .select("credit_limit")
    .eq("merchant_id", merchantId)
    .eq("customer_id", customerId)
    .maybeSingle();

  const creditLimit = mc?.credit_limit || 0;

  const { data: logs } = await (admin.from("credit_logs") as any)
    .select("amount, type")
    .eq("merchant_id", merchantId)
    .eq("customer_id", customerId)
    .eq("status", "approved")
    .neq("type", "cash");

  const balance = (logs || []).reduce((sum: number, l: any) => {
    return sum + (l.type === "debit" ? l.amount : -l.amount);
  }, 0);

  return { balance, creditLimit };
}

// ──────────────────────────────────────────────
// Write Operations
// ──────────────────────────────────────────────

export async function resetCustomerPin(
  merchantId: string,
  customerId: string
): Promise<{ success: boolean; error?: string }> {
  const sessionUserId = await requireMerchant().catch(() => null);
  if (!sessionUserId || sessionUserId !== merchantId) {
    return { success: false, error: "Not logged in" };
  }

  const admin = getAdminClient();
  if (!admin) return { success: false, error: "Server config" };

  const { data: mc } = await (admin.from("merchant_customers") as any)
    .select("customer_id")
    .eq("merchant_id", merchantId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (!mc) {
    return { success: false, error: "Customer not found" };
  }

  const { error: updateError } = await (admin.from("customers") as any)
    .update({ pin_hash: null })
    .eq("id", customerId);

  if (updateError) {
    return { success: false, error: "Failed to reset PIN" };
  }

  const { error: auditError } = await (admin.from("audit_logs") as any).insert({
    credit_log_id: null,
    action: "pin_reset",
    actor_type: "merchant",
    actor_id: merchantId,
  });

  if (auditError) {
    console.error("Audit log insert failed:", auditError);
  }

  return { success: true };
}

export async function updateCustomerCreditLimit(
  merchantId: string,
  customerId: string,
  creditLimit: number
) {
  const admin = getAdminClient();
  if (!admin) throw new Error("Server config");

  const sessionUserId = await requireMerchant().catch(() => null);
  if (!sessionUserId || sessionUserId !== merchantId) throw new Error("Not logged in");

  const { data, error } = await (admin.from("merchant_customers") as any)
    .update({ credit_limit: creditLimit })
    .eq("merchant_id", merchantId)
    .eq("customer_id", customerId)
    .select("id, merchant_id, customer_id, credit_limit")
    .single();

  if (error) throw error;
  return data;
}

export async function updateCreditLogStatus(
  logId: string,
  status: "approved" | "disputed" | "rejected" | "pending" | "unverified" | "edit_requested",
  actorType?: "merchant" | "customer"
) {
  const admin = getAdminClient();
  if (!admin) throw new Error("Server config");

  // Merchant session check (relaxed: verify we have a merchant session, but the log may belong to them)
  const sessionUserId = await requireMerchant().catch(() => null);
  if (!sessionUserId) throw new Error("Not logged in");

  const updates: Record<string, unknown> = {};
  if (status === "approved") updates.approved_at = new Date().toISOString();
  updates.status = status;

  const { data, error } = await (admin.from("credit_logs") as any)
    .update(updates)
    .eq("id", logId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getMerchantRecentDescriptions(merchantId: string): Promise<string[]> {
  const admin = getAdminClient();
  if (!admin) return [];

  const sessionUserId = await requireMerchant().catch(() => null);
  if (!sessionUserId || sessionUserId !== merchantId) return [];

  const { data } = await (admin.from("credit_logs") as any)
    .select("description")
    .eq("merchant_id", merchantId)
    .neq("description", "")
    .not("description", "is", null)
    .order("created_at", { ascending: false })
    .limit(20);

  if (!data) return [];
  const seen = new Set<string>();
  return data
    .map((r: any) => r.description as string)
    .filter((d: string) => {
      if (seen.has(d)) return false;
      seen.add(d);
      return true;
    })
    .slice(0, 5);
}

export async function uploadAttachment(
  merchantId: string,
  logId: string,
  file: Blob
): Promise<string> {
  const sessionUserId = await requireMerchant().catch(() => null);
  if (!sessionUserId || sessionUserId !== merchantId) {
    throw new Error("Not logged in");
  }

  const admin = getAdminClient();
  if (!admin) throw new Error("Server config");

  const fileName = `${merchantId}/${logId}/${Date.now()}.webp`;
  const { error } = await admin.storage
    .from("transaction_attachments")
    .upload(fileName, file, {
      contentType: "image/webp",
      upsert: true,
    });
  if (error) throw error;

  const { data: urlData } = admin.storage
    .from("transaction_attachments")
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

// ──────────────────────────────────────────────
// Customer Trust Status
// ──────────────────────────────────────────────

/**
 * View a customer's trust_status (masked to 'unknown' if no relationship exists).
 * Used by the customer detail page to enforce the "relation-only" access rule.
 */
export async function getCustomerTrustStatus(
  merchantId: string,
  customerId: string
): Promise<{ trust_status: string; trust_notes: string | null }> {
  const sessionUserId = await requireMerchant().catch(() => null);
  if (!sessionUserId || sessionUserId !== merchantId) {
    throw new Error("Not logged in");
  }
  const admin = getAdminClient();
  if (!admin) throw new Error("Server config");

  // Verify relationship exists via merchant_customers OR credit_logs
  const { data: rel } = await (admin.from("merchant_customers") as any)
    .select("id")
    .eq("merchant_id", merchantId)
    .eq("customer_id", customerId)
    .maybeSingle();

  const { data: logRel } = !rel
    ? await (admin.from("credit_logs") as any)
        .select("id")
        .eq("merchant_id", merchantId)
        .eq("customer_id", customerId)
        .limit(1)
        .maybeSingle()
    : { data: null };

  // No relationship → mask trust status
  if (!rel && !logRel) {
    return { trust_status: "unknown", trust_notes: null };
  }

  // Relationship exists → return actual status (but NOT flagged_by_merchant_id)
  const { data: cust } = await (admin.from("customers") as any)
    .select("trust_status, trust_notes")
    .eq("id", customerId)
    .single();

  return {
    trust_status: cust?.trust_status || "good",
    trust_notes: cust?.trust_notes || null,
  };
}

/**
 * Flag or clear a customer's trust status.
 * Only the flagging merchant can modify/clear their own flag.
 */
export async function updateCustomerTrustStatus(
  merchantId: string,
  customerId: string,
  action: "flag" | "clear",
  options?: { status?: "warning" | "defaulter"; notes?: string }
): Promise<{ success: boolean; error?: string }> {
  const sessionUserId = await requireMerchant().catch(() => null);
  if (!sessionUserId || sessionUserId !== merchantId) {
    return { success: false, error: "Not logged in" };
  }
  const admin = getAdminClient();
  if (!admin) return { success: false, error: "Server config" };

  // Verify relationship exists
  const { data: rel } = await (admin.from("merchant_customers") as any)
    .select("id")
    .eq("merchant_id", merchantId)
    .eq("customer_id", customerId)
    .maybeSingle();

  const { data: logRel } = !rel
    ? await (admin.from("credit_logs") as any)
        .select("id")
        .eq("merchant_id", merchantId)
        .eq("customer_id", customerId)
        .limit(1)
        .maybeSingle()
    : { data: null };

  if (!rel && !logRel) {
    return { success: false, error: "No customer relationship found" };
  }

  if (action === "flag") {
    const status = options?.status || "warning";
    if (!["warning", "defaulter"].includes(status)) {
      return { success: false, error: "Invalid trust status" };
    }
    const { error } = await (admin.from("customers") as any)
      .update({
        trust_status: status,
        trust_notes: options?.notes || null,
        flagged_by_merchant_id: merchantId,
        flagged_at: new Date().toISOString(),
      })
      .eq("id", customerId);

    if (error) {
      console.error("[TrustStatus] Flag error:", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  }

  if (action === "clear") {
    // Only the flagging merchant can clear
    const { data: cust } = await (admin.from("customers") as any)
      .select("flagged_by_merchant_id")
      .eq("id", customerId)
      .single();

    if (!cust) return { success: false, error: "Customer not found" };
    if (cust.flagged_by_merchant_id !== merchantId) {
      return { success: false, error: "Only the merchant who flagged can remove this status" };
    }

    const { error } = await (admin.from("customers") as any)
      .update({
        trust_status: "good",
        trust_notes: null,
        flagged_by_merchant_id: null,
        flagged_at: null,
      })
      .eq("id", customerId);

    if (error) {
      console.error("[TrustStatus] Clear error:", error);
      return { success: false, error: error.message };
    }
    return { success: true };
  }

  return { success: false, error: "Invalid action" };
}

// ──────────────────────────────────────────────
// Audit Logs
// ──────────────────────────────────────────────

export async function getAuditLogsForCreditLog(
  creditLogId: string
): Promise<Array<{
  id: string;
  action: string;
  actor_type: string | null;
  actor_id: string | null;
  ip_address: string | null;
  device_info: string | null;
  previous_values: unknown;
  created_at: string;
}>> {
  const admin = getAdminClient();
  if (!admin) return [];

  const sessionUserId = await requireMerchant().catch(() => null);
  if (!sessionUserId) return [];

  const { data } = await (admin.from("audit_logs") as any)
    .select("id, action, actor_type, actor_id, ip_address, device_info, previous_values, created_at")
    .eq("credit_log_id", creditLogId)
    .order("created_at", { ascending: true });

  if (!data) return [];
  return data;
}

// ──────────────────────────────────────────────
// Payment Methods CRUD
// ──────────────────────────────────────────────

export async function getMerchantPaymentMethods(
  merchantId: string
): Promise<Array<{
  id: string;
  merchant_id: string;
  method_type: string;
  label: string | null;
  qr_url: string | null;
  account_holder: string | null;
  account_number: string | null;
  bank_name: string | null;
  is_active: boolean;
  sort_order: number;
  updated_at: string;
}>> {
  const admin = getAdminClient();
  if (!admin) return [];

  const sessionUserId = await requireMerchant().catch(() => null);
  if (!sessionUserId || sessionUserId !== merchantId) return [];

  const { data } = await (admin.from("merchant_payment_methods") as any)
    .select("*")
    .eq("merchant_id", merchantId)
    .order("sort_order", { ascending: true })
    .order("method_type", { ascending: true });

  return data || [];
}

export async function upsertMerchantPaymentMethod(
  merchantId: string,
  methodType: string,
  data: {
    label?: string | null;
    qr_url?: string | null;
    account_holder?: string | null;
    account_number?: string | null;
    bank_name?: string | null;
    is_active?: boolean;
    sort_order?: number;
  }
): Promise<{ success: boolean; error?: string }> {
  const admin = getAdminClient();
  if (!admin) return { success: false, error: "Server config" };

  const sessionUserId = await requireMerchant().catch(() => null);
  if (!sessionUserId || sessionUserId !== merchantId) {
    return { success: false, error: "Not logged in" };
  }

  const validTypes = ["fonepay", "esewa", "khalti", "nepalpay", "bank_deposit", "cash"];
  if (!validTypes.includes(methodType)) {
    return { success: false, error: "Invalid method type" };
  }

  const payload: Record<string, unknown> = {
    ...data,
    updated_at: new Date().toISOString(),
  };

  const { error } = await (admin.from("merchant_payment_methods") as any)
    .upsert(
      { merchant_id: merchantId, method_type: methodType, ...payload },
      { onConflict: "merchant_id, method_type" }
    );

  if (error) {
    console.error("[PaymentMethod] upsert error:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function deleteMerchantPaymentMethod(
  merchantId: string,
  methodType: string
): Promise<{ success: boolean; error?: string }> {
  const admin = getAdminClient();
  if (!admin) return { success: false, error: "Server config" };

  const sessionUserId = await requireMerchant().catch(() => null);
  if (!sessionUserId || sessionUserId !== merchantId) {
    return { success: false, error: "Not logged in" };
  }

  const { error } = await (admin.from("merchant_payment_methods") as any)
    .delete()
    .eq("merchant_id", merchantId)
    .eq("method_type", methodType);

  if (error) {
    console.error("[PaymentMethod] delete error:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ──────────────────────────────────────────────
// Reminder Settings
// ──────────────────────────────────────────────

export async function getMerchantReminderSettings(
  merchantId: string
): Promise<{
  id: string;
  merchant_id: string;
  auto_reminder_enabled: boolean;
  reminder_message_template: string | null;
  reminder_day_of_month: number;
  last_reminder_at: string | null;
} | null> {
  const admin = getAdminClient();
  if (!admin) return null;

  const sessionUserId = await requireMerchant().catch(() => null);
  if (!sessionUserId || sessionUserId !== merchantId) return null;

  const { data } = await (admin.from("merchant_reminder_settings") as any)
    .select("*")
    .eq("merchant_id", merchantId)
    .maybeSingle();

  return data || null;
}

export async function updateMerchantReminderSettings(
  merchantId: string,
  data: {
    auto_reminder_enabled?: boolean;
    reminder_message_template?: string | null;
    reminder_day_of_month?: number;
  }
): Promise<{ success: boolean; error?: string }> {
  const admin = getAdminClient();
  if (!admin) return { success: false, error: "Server config" };

  const sessionUserId = await requireMerchant().catch(() => null);
  if (!sessionUserId || sessionUserId !== merchantId) {
    return { success: false, error: "Not logged in" };
  }

  const payload: Record<string, unknown> = {
    ...data,
    updated_at: new Date().toISOString(),
  };

  const { error } = await (admin.from("merchant_reminder_settings") as any)
    .upsert(
      { merchant_id: merchantId, ...payload },
      { onConflict: "merchant_id" }
    );

  if (error) {
    console.error("[ReminderSettings] upsert error:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ──────────────────────────────────────────────
// Payment Reminder Actions
// ──────────────────────────────────────────────

export async function sendPaymentReminder(
  merchantId: string,
  customerId: string,
  type: "sms" | "share_link"
): Promise<{ success: boolean; error?: string }> {
  const admin = getAdminClient();
  if (!admin) return { success: false, error: "Server config" };

  const sessionUserId = await requireMerchant().catch(() => null);
  if (!sessionUserId || sessionUserId !== merchantId) {
    return { success: false, error: "Not logged in" };
  }

  try {
    const [merchantResult, customerResult, balanceResult] = await Promise.all([
      (admin.from("merchants") as any).select("name").eq("id", merchantId).single(),
      (admin.from("customers") as any).select("name, phone").eq("id", customerId).single(),
      (admin.from("merchant_customers") as any)
        .select("current_balance")
        .eq("merchant_id", merchantId)
        .eq("customer_id", customerId)
        .maybeSingle(),
    ]);

    const shopName = merchantResult.data?.name || "Shop";
    const customerName = customerResult.data?.name || "Customer";
    const customerPhone = customerResult.data?.phone || "";
    const balance = balanceResult.data?.current_balance || 0;

    let message: string;

    if (type === "sms") {
      const firstName = shopName.split(" ")[0];
      message = `Dear ${customerName}, pay Rs. ${Number(balance).toLocaleString()} to ${firstName}.`;
      if (message.length > 150) {
        message = message.substring(0, 147) + "...";
      }

      const { sendTransactionSMS } = await import("./sms");
      const smsResult = await sendTransactionSMS(customerPhone, message);

      await (admin.from("payment_reminder_logs") as any).insert({
        merchant_id: merchantId,
        customer_id: customerId,
        type: "sms",
        message,
        status: smsResult.success ? "sent" : "failed",
        error_message: smsResult.error || null,
      });

      if (!smsResult.success) {
        return { success: false, error: smsResult.error || "SMS failed" };
      }
    } else {
      const methods = await (admin.from("merchant_payment_methods") as any)
        .select("method_type, label, qr_url, account_holder, account_number, bank_name")
        .eq("merchant_id", merchantId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      const methodLines = (methods.data || []).map((m: any) => {
        if (m.method_type === "bank_deposit") {
          return `${m.bank_name || "Bank"}: ${m.account_holder || ""} ${m.account_number || ""}`;
        }
        return m.label || m.method_type;
      });

      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.qrhisab.com";
      const ledgerLink = `${baseUrl}/customer/history?merchantId=${merchantId}`;
      const paymentLink = `${baseUrl}/customer/payment-methods?merchantId=${merchantId}`;

      message = `Dear ${customerName}, your outstanding balance at ${shopName} is Rs. ${Number(balance).toLocaleString()}. View ledger: ${ledgerLink}. Payment methods: ${paymentLink}`;

      await (admin.from("payment_reminder_logs") as any).insert({
        merchant_id: merchantId,
        customer_id: customerId,
        type: "share_link",
        message,
        status: "sent",
      });
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[sendPaymentReminder] error:", msg);
    return { success: false, error: msg };
  }
}

export async function getReminderLogs(
  merchantId: string
): Promise<Array<{
  id: string;
  merchant_id: string;
  customer_id: string;
  credit_log_id: string | null;
  type: string;
  message: string;
  sent_at: string;
  status: string;
  error_message: string | null;
  customers: { name: string | null; phone: string } | null;
}>> {
  const admin = getAdminClient();
  if (!admin) return [];

  const sessionUserId = await requireMerchant().catch(() => null);
  if (!sessionUserId || sessionUserId !== merchantId) return [];

  const { data } = await (admin.from("payment_reminder_logs") as any)
    .select("*, customers(name, phone)")
    .eq("merchant_id", merchantId)
    .order("sent_at", { ascending: false })
    .limit(50);

  return data || [];
}

export async function checkAndSendAutoReminders(
  merchantId: string
): Promise<{ success: boolean; sent: number; error?: string }> {
  const admin = getAdminClient();
  if (!admin) return { success: false, sent: 0, error: "Server config" };

  const sessionUserId = await requireMerchant().catch(() => null);
  if (!sessionUserId || sessionUserId !== merchantId) {
    return { success: false, sent: 0, error: "Not logged in" };
  }

  try {
    const { data: settings } = await (admin.from("merchant_reminder_settings") as any)
      .select("*")
      .eq("merchant_id", merchantId)
      .maybeSingle();

    if (!settings || !settings.auto_reminder_enabled) {
      return { success: true, sent: 0 };
    }

    const now = new Date();
    const today = now.getUTCDate();
    const currentMonth = now.getUTCMonth();
    const currentYear = now.getUTCFullYear();

    const startOfMonth = new Date(Date.UTC(currentYear, currentMonth, 1)).toISOString();

    if (today < settings.reminder_day_of_month) {
      return { success: true, sent: 0 };
    }

    if (settings.last_reminder_at && settings.last_reminder_at >= startOfMonth) {
      return { success: true, sent: 0 };
    }

    const { data: customers } = await (admin.from("merchant_customers") as any)
      .select("customer_id, current_balance, customers!inner(name, phone)")
      .eq("merchant_id", merchantId)
      .gt("current_balance", 0);

    if (!customers || customers.length === 0) {
      return { success: true, sent: 0 };
    }

    const { data: merchant } = await (admin.from("merchants") as any)
      .select("name")
      .eq("id", merchantId)
      .single();

    const shopName = merchant?.name || "Shop";
    const firstName = shopName.split(" ")[0];
    const template = settings.reminder_message_template || "Dear {customer}, pay Rs. {balance} to {shop}.";
    const { sendTransactionSMS } = await import("./sms");

    let sent = 0;
    for (const row of customers) {
      const customerName = row.customers?.name || "Customer";
      const customerPhone = row.customers?.phone;
      if (!customerPhone) continue;

      let msg = template
        .replace(/\{customer\}/g, customerName)
        .replace(/\{balance\}/g, Number(row.current_balance).toLocaleString())
        .replace(/\{shop\}/g, firstName);

      if (msg.length > 150) {
        msg = msg.substring(0, 147) + "...";
      }

      const result = await sendTransactionSMS(customerPhone, msg);

      await (admin.from("payment_reminder_logs") as any).insert({
        merchant_id: merchantId,
        customer_id: row.customer_id,
        type: "sms",
        message: msg,
        status: result.success ? "sent" : "failed",
        error_message: result.error || null,
      });

      if (result.success) sent++;
    }

    await (admin.from("merchant_reminder_settings") as any)
      .update({ last_reminder_at: now.toISOString() })
      .eq("merchant_id", merchantId);

    return { success: true, sent };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[checkAndSendAutoReminders] error:", msg);
    return { success: false, sent: 0, error: msg };
  }
}

// ──────────────────────────────────────────────
// Public: Merchant Payment Methods (customer-facing)
// ──────────────────────────────────────────────

export async function getMerchantPaymentMethodsPublic(
  merchantId: string
): Promise<Array<{
  method_type: string;
  label: string | null;
  qr_url: string | null;
  account_holder: string | null;
  account_number: string | null;
  bank_name: string | null;
  is_active: boolean;
}>> {
  const admin = getAdminClient();
  if (!admin) return [];

  const { data } = await (admin.from("merchant_payment_methods") as any)
    .select("method_type, label, qr_url, account_holder, account_number, bank_name, is_active")
    .eq("merchant_id", merchantId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("method_type", { ascending: true });

  return data || [];
}
