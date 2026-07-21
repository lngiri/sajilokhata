"use client";

import { createClient } from "@/lib/supabase/client";
import { normalizePhone } from "@/lib/phone";

let supabaseClient: ReturnType<typeof createClient> | null = null;

export function getClient() {
  if (!supabaseClient) {
    supabaseClient = createClient();
  }
  return supabaseClient;
}

export function clearCachedClient() {
  supabaseClient = null;
}

// ============================================================
// Merchant Actions
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getMerchantProfile(merchantId: string, columns = "*"): Promise<any> {
  const { data, error } = await getClient()
    .from("merchants")
    .select(columns)
    .eq("id", merchantId)
    .single();

  if (error) throw error;
  return data;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateMerchantProfile(
  merchantId: string,
  updates: {
    name?: string;
    business_name?: string;
    business_type?: string;
    address?: string;
    phone?: string;
    photo_url?: string | null;
  }
): Promise<any> {
  const res = await fetch("/api/merchant/profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ merchant_id: merchantId, ...updates }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to save profile");
  }

  // If the API resolved a different merchant_id (e.g. merged duplicates),
  // sync it back to localStorage so the frontend uses the correct ID.
  if (data.merchant_id && data.merchant_id !== merchantId) {
    if (typeof window !== "undefined") {
      localStorage.setItem("merchant_id", data.merchant_id);
    }
  }

  return data.profile;
}

// ============================================================
// Customer Linking
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function findOrCreateCustomer(
  phone: string,
  name?: string
): Promise<any> {
  const np = normalizePhone(phone);
  let { data: customer } = await getClient()
    .from("customers")
    .select("*")
    .eq("phone", np)
    .maybeSingle();

  if (!customer) {
    const { data: newCustomer, error } = await getClient()
      .from("customers")
      .insert({ phone: np, name: name || null })
      .select()
      .single();

    if (error) throw error;
    customer = newCustomer;
  }

  return customer;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function linkCustomerToMerchant(
  merchantId: string,
  customerId: string,
  creditLimit: number = 5000
): Promise<any> {
  const { data: existing } = await getClient()
    .from("merchant_customers")
    .select("id, merchant_id, customer_id, credit_limit, created_at, updated_at")
    .eq("merchant_id", merchantId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await getClient()
    .from("merchant_customers")
    .insert({
      merchant_id: merchantId,
      customer_id: customerId,
      credit_limit: creditLimit,
    })
    .select("id, merchant_id, customer_id, credit_limit, created_at, updated_at")
    .single();

  if (error) throw error;
  return data;
}

// ============================================================
// Credit Logs
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createCreditLog(log: Record<string, any>): Promise<any> {
  if (!log.merchant_id) {
    throw new Error("merchant_id is required");
  }
  if (log.type !== "cash" && !log.customer_id) {
    throw new Error("customer_id is required for debit/credit transactions");
  }
  if (!log.amount || typeof log.amount !== "number" || log.amount <= 0) {
    throw new Error("amount must be a positive number");
  }
  if (!log.type || !["debit", "credit", "cash"].includes(log.type)) {
    throw new Error("type must be 'debit', 'credit', or 'cash'");
  }

  const { data, error } = await getClient()
    .from("credit_logs")
    .insert(log)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
): Promise<any[]> {
  let query = getClient()
    .from("credit_logs")
    .select(options?.columns || "*, customers(name, phone)")
    .eq("merchant_id", merchantId)
    .order("created_at", { ascending: false });

  if (options?.status) {
    query = query.eq("status", options.status);
  }
  if (options?.customerId) {
    query = query.eq("customer_id", options.customerId);
  }
  if (options?.dateFrom) {
    query = query.gte("created_at", options.dateFrom);
  }
  if (options?.dateTo) {
    query = query.lte("created_at", options.dateTo + "T23:59:59.999Z");
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

export async function getCashSales(
  merchantId: string,
  options?: {
    limit?: number;
    offset?: number;
    dateFrom?: string;
    dateTo?: string;
  }
): Promise<any[]> {
  let query = getClient()
    .from("credit_logs")
    .select("id, amount, quantity, unit, description, type, status, created_at, approved_at")
    .eq("merchant_id", merchantId)
    .eq("type", "cash")
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (options?.dateFrom) {
    query = query.gte("created_at", options.dateFrom);
  }
  if (options?.dateTo) {
    query = query.lte("created_at", options.dateTo + "T23:59:59.999Z");
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateCreditLogStatus(
  logId: string,
  status: "approved" | "disputed" | "rejected" | "pending" | "unverified" | "edit_requested",
  actorType?: "merchant" | "customer"
): Promise<any> {
  const updates: Record<string, unknown> = {};
  if (status === "approved") {
    updates.approved_at = new Date().toISOString();
  }
  updates.status = status;

  const { data, error } = await getClient()
    .from("credit_logs")
    .update(updates)
    .eq("id", logId)
    .select()
    .single();

  if (error) throw error;

  return data;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateCreditLog(
  logId: string,
  updates: { amount?: number; description?: string }
): Promise<any> {
  const payload: Record<string, unknown> = {};
  if (updates.amount !== undefined) payload.amount = updates.amount;
  if (updates.description !== undefined) payload.description = updates.description;

  const { data, error } = await getClient()
    .from("credit_logs")
    .update(payload)
    .eq("id", logId)
    .eq("status", "pending")
    .select()
    .single();

  if (error) throw error;
  return data;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function cancelCreditLog(logId: string): Promise<any> {
  return updateCreditLogStatus(logId, "rejected", "customer");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function uploadAttachment(
  merchantId: string,
  logId: string,
  file: Blob
): Promise<string> {
  const fileName = `${merchantId}/${logId}/${Date.now()}.webp`;
  const { error } = await getClient()
    .storage
    .from("transaction_attachments")
    .upload(fileName, file, {
      contentType: "image/webp",
      upsert: true,
    });
  if (error) throw error;

  const { data: urlData } = getClient()
    .storage
    .from("transaction_attachments")
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createManualCreditLog(params: {
  merchant_id: string;
  customer_id?: string | null;
  amount: number;
  type: "debit" | "credit" | "cash";
  description?: string | null;
  attachment_url?: string | null;
}): Promise<any> {
  const isCash = params.type === "cash";
  return createCreditLog({
    merchant_id: params.merchant_id,
    customer_id: isCash ? null : params.customer_id,
    amount: params.amount,
    type: params.type,
    description: params.description || null,
    status: isCash ? "approved" : "unverified",
    approved_at: isCash ? new Date().toISOString() : null,
    attachment_url: params.attachment_url || null,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function confirmCustomerEntry(logId: string): Promise<any> {
  return updateCreditLogStatus(logId, "approved", "customer");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function disputeEntry(logId: string): Promise<any> {
  return updateCreditLogStatus(logId, "disputed", "customer");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getMerchantCustomerBalance(
  merchantId: string,
  customerId: string
): Promise<{ balance: number; creditLimit: number }> {
  const { data: mc } = await getClient()
    .from("merchant_customers")
    .select("credit_limit")
    .eq("merchant_id", merchantId)
    .eq("customer_id", customerId)
    .maybeSingle();

  const creditLimit = (mc as any)?.credit_limit || 0;

  const { data: logs } = await getClient()
    .from("credit_logs")
    .select("amount, type")
    .eq("merchant_id", merchantId)
    .eq("customer_id", customerId)
    .eq("status", "approved")
    .neq("type", "cash");

  const balance =
    (logs as any[])?.reduce((sum: number, l: any) => {
      return sum + (l.type === "debit" ? l.amount : -l.amount);
    }, 0) || 0;

  return { balance, creditLimit };
}

// ============================================================
// Customer Summary
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getMerchantCustomers(merchantId: string): Promise<any[]> {
  const { data, error } = await getClient()
    .from("merchant_customers")
    .select("*, customers(id, name, phone)")
    .eq("merchant_id", merchantId);

  if (error) throw error;

  const rows = data || [];
  if (rows.length === 0) return [];

  const seen = new Set<string>();
  const deduped = rows.filter((r: any) => {
    if (seen.has(r.customer_id)) return false;
    seen.add(r.customer_id);
    return true;
  });

  const customerIds = deduped.map((r: any) => r.customer_id);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const approvedLogsResult: any = await getClient()
    .from("credit_logs")
    .select("customer_id, amount, type")
    .eq("merchant_id", merchantId)
    .eq("status", "approved")
    .neq("type", "cash")
    .in("customer_id", customerIds);

  if (approvedLogsResult.error) throw approvedLogsResult.error;
  const approvedLogs = approvedLogsResult.data as any[] | null;

  const balanceMap: Record<string, number> = {};
  for (const log of approvedLogs || []) {
    const sign = log.type === "debit" ? 1 : -1;
    balanceMap[log.customer_id] = (balanceMap[log.customer_id] || 0) + sign * log.amount;
  }

  return deduped
    .map((r: any) => ({ ...r, current_balance: balanceMap[r.customer_id] || 0 }))
    .sort((a: any, b: any) => b.current_balance - a.current_balance);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateCustomerCreditLimit(
  merchantId: string,
  customerId: string,
  creditLimit: number
): Promise<any> {
  const { data, error } = await getClient()
    .from("merchant_customers")
    .update({ credit_limit: creditLimit })
    .eq("merchant_id", merchantId)
    .eq("customer_id", customerId)
    .select("id, merchant_id, customer_id, credit_limit")
    .single();

  if (error) throw error;
  return data;
}

// ============================================================
// Merchant Lookup (for customer-facing flows)
// ============================================================

/**
 * Find a merchant by their registered phone number.
 * Used by customers to submit remote credit requests.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getMerchantByPhone(
  phone: string
): Promise<{ id: string; name: string; business_name: string | null; business_type: string; phone: string } | null> {
  const np = normalizePhone(phone);
  const { data, error } = await getClient()
    .from("merchants")
    .select("id, name, business_name, business_type, phone")
    .eq("phone", np)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Get customer statistics — total outstanding balance across all shops,
 * number of shops they owe at, and a per-shop breakdown.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCustomerStats(
  customerPhone: string
): Promise<{
  totalOutstanding: number;
  shopsCount: number;
  totalCreditLimit: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  relationships: any[];
} | null> {
  // First find the customer record(s) by phone
  const np = normalizePhone(customerPhone);
  const { data: customers } = await getClient()
    .from("customers")
    .select("id")
    .eq("phone", np);

  if (!customers || customers.length === 0) return null;

  const customerIds = customers.map((c: any) => c.id);

  // Get all merchant relationships with credit limit and merchant info
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: relationships, error } = (await getClient()
    .from("merchant_customers")
    .select("credit_limit, merchants(id, name, business_name)")
    .in("customer_id", customerIds)) as any;

  if (error) throw error;

  // Compute balance from approved or pending-Opening-Balance credit_logs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: balanceLogs } = await getClient()
    .from("credit_logs")
    .select("merchant_id, amount, type, status, description")
    .in("customer_id", customerIds)
    .neq("type", "cash")
    .not("status", "in", '("rejected","disputed")') as unknown as { data: any[] | null };

  const balanceByMerchant: Record<string, number> = {};
  for (const log of balanceLogs || []) {
    if (log.status === "approved" || (log.status === "pending" && (log.description as string)?.startsWith("Opening Balance"))) {
      const sign = log.type === "debit" ? 1 : -1;
      balanceByMerchant[log.merchant_id] = (balanceByMerchant[log.merchant_id] || 0) + sign * log.amount;
    }
  }

  const totalOutstanding = Object.values(balanceByMerchant).reduce((sum, b) => sum + b, 0);
  const totalCreditLimit =
    relationships?.reduce((sum: number, r: any) => sum + (r.credit_limit || 0), 0) || 0;

  const relationshipsWithBalance = (relationships || []).map((r: any) => ({
    ...r,
    current_balance: balanceByMerchant[r.merchants?.id] || 0,
  }));

  return {
    totalOutstanding,
    shopsCount: relationships?.length || 0,
    totalCreditLimit,
    relationships: relationshipsWithBalance,
  };
}

/**
 * Get credit logs associated with a customer (by their phone number).
 * Returns entries across all merchants this customer has transacted with.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getCustomerCreditLogs(
  customerPhone: string,
  options?: {
    status?: string;
    limit?: number;
    offset?: number;
    merchant_id?: string;
  }
): Promise<any[]> {
  // First find the customer record(s) by phone
  const np = normalizePhone(customerPhone);
  const { data: customers } = await getClient()
    .from("customers")
    .select("id, name")
    .eq("phone", np);

  if (!customers || customers.length === 0) return [];

  const customerIds = customers.map((c) => c.id);

  let query = getClient()
    .from("credit_logs")
    .select("*, customers(name, phone), merchants!inner(id, name, business_name)")
    .in("customer_id", customerIds)
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

// ============================================================
// Stats
// ============================================================

interface StatsResult {
  totalOutstanding: number;
  totalCreditLimit: number;
  customerCount: number;
  pendingCount: number;
  todayTotal: number;
  totalCashSales: number;
  totalSales: number;
  cashInHand: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getMerchantStats(merchantId: string): Promise<StatsResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: customers } = await getClient()
    .from("merchant_customers")
    .select("credit_limit")
    .eq("merchant_id", merchantId) as any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pendingLogs } = await getClient()
    .from("credit_logs")
    .select("id, amount")
    .eq("merchant_id", merchantId)
    .eq("status", "pending") as any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allApprovedLogs } = await getClient()
    .from("credit_logs")
    .select("amount, type, created_at")
    .eq("merchant_id", merchantId)
    .eq("status", "approved") as any;

  const today = new Date().toISOString().split("T")[0];

  const rows = (allApprovedLogs || []) as any[];
  const balanceLogs = rows.filter((l: any) => l.type !== "cash");
  const cashLogs = rows.filter((l: any) => l.type === "cash");
  const paymentLogs = rows.filter((l: any) => l.type === "credit");

  // Outstanding: debits - credits (excluding cash)
  const totalOutstanding = balanceLogs.reduce((sum: number, l: any) => {
    return sum + (l.type === "debit" ? l.amount : -l.amount);
  }, 0);

  // Today's net outstanding change (excluding cash)
  const todayTotal = balanceLogs.reduce((sum: number, l: any) => {
    if (!l.created_at?.startsWith(today)) return sum;
    return sum + (l.type === "debit" ? l.amount : -l.amount);
  }, 0);

  // Cash Sales: sum of all approved cash entries (today)
  const totalCashSales = cashLogs.reduce((sum: number, l: any) => {
    if (!l.created_at?.startsWith(today)) return sum;
    return sum + l.amount;
  }, 0);

  // Today's debits (new credit given) for Total Sales
  const todayDebits = balanceLogs.reduce((sum: number, l: any) => {
    if (!l.created_at?.startsWith(today)) return sum;
    return l.type === "debit" ? sum + l.amount : sum;
  }, 0);

  // Total Sales = Credit Sales (today's debits) + Cash Sales (today)
  const totalSales = todayDebits + totalCashSales;

  // Cash In Hand = Cash Sales + Amount Received (payments), today only
  const todayPayments = paymentLogs.reduce((sum: number, l: any) => {
    if (!l.created_at?.startsWith(today)) return sum;
    return sum + l.amount;
  }, 0);
  const cashInHand = totalCashSales + todayPayments;

  const totalCreditLimit = customers?.reduce((sum: number, c: any) => sum + (c.credit_limit || 0), 0) || 0;
  const pendingCount = pendingLogs?.length || 0;

  return { totalOutstanding, totalCreditLimit, customerCount: customers?.length || 0, pendingCount, todayTotal, totalCashSales, totalSales, cashInHand };
}

// ============================================================
// Analytics & Reports
// ============================================================

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
  let query = getClient()
    .from("credit_logs")
    .select("amount, type, created_at, customers(name, phone)")
    .eq("merchant_id", merchantId)
    .eq("status", "approved")
    .order("created_at", { ascending: true });

  if (dateFrom) query = query.gte("created_at", dateFrom);
  if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59.999Z");

  const { data: logs, error } = await query;
  if (error) throw error;

  const rows = logs as any[] || [];

  // Aggregate metrics
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
        customerBal[cusKey] = {
          name: l.customers.name || cusKey,
          phone: cusKey,
          balance: 0,
        };
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

  return {
    totalOutstanding,
    totalReceived,
    totalCashSales,
    totalSales,
    cashInHand,
    netCashFlow: totalReceived - totalOutstanding,
    topCustomers,
    dailyBreakdown,
  };
}

// ============================================================
// Description Suggestions
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getMerchantRecentDescriptions(merchantId: string): Promise<string[]> {
  const { data, error } = await getClient()
    .from("credit_logs")
    .select("description")
    .eq("merchant_id", merchantId)
    .neq("description", "")
    .not("description", "is", null)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw error;
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

// ============================================================
// OTP Rate Limiting (Client-side)
// ============================================================

const otpRateLimitMap = new Map<string, { count: number; firstAttempt: number }>();

export function checkOtpRateLimit(phone: string): boolean {
  const now = Date.now();
  const entry = otpRateLimitMap.get(phone);

  if (entry && now - entry.firstAttempt > 60000) {
    otpRateLimitMap.delete(phone);
    return true;
  }

  if (entry && entry.count >= 3) {
    return false;
  }

  otpRateLimitMap.set(phone, {
    count: (entry?.count || 0) + 1,
    firstAttempt: entry?.firstAttempt || now,
  });
  return true;
}

// ============================================================
// Verification Token (WhatsApp Remote Approve)
// ============================================================

export async function getCreditLogByToken(
  token: string
): Promise<{
  id: string;
  amount: number;
  type: string;
  status: string;
  description: string | null;
  customer_id: string;
  merchant_id: string;
  proposed_amount: number | null;
  customers: { name: string | null; phone: string; address: string } | null;
  merchants: { name: string | null } | null;
} | null> {
  const { data, error } = await getClient()
    .from("credit_logs")
    .select("id, amount, type, status, description, customer_id, merchant_id, proposed_amount, customers(name, phone, address), merchants(name)")
    .eq("verification_token", token)
    .maybeSingle();

  if (error) throw error;
  return data as any;
}

export async function approveByToken(
  token: string
): Promise<any> {
  const res = await fetch("/api/verify/approve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });

  const data = await res.json();

  if (!res.ok) {
    const msg = data.code === "CREDIT_LIMIT_EXCEEDED" ? data.error : (data.error || "Failed to approve");
    throw new Error(msg);
  }

  return data;
}

export async function disputeByToken(
  token: string,
  reason: string
): Promise<any> {
  const res = await fetch("/api/verify/dispute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, reason }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to dispute");
  }

  return data;
}

export async function requestAmountEdit(
  token: string,
  proposedAmount: number
): Promise<any> {
  const res = await fetch("/api/verify/edit-request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, proposedAmount }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to submit edit request");
  }

  return data;
}

export async function acceptEditRequest(
  logId: string
): Promise<any> {
  const res = await fetch("/api/verify/accept-edit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ logId }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to accept edit");
  }

  return data;
}

export async function rejectEditRequest(
  logId: string
): Promise<any> {
  const res = await fetch("/api/verify/reject-edit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ logId }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to reject edit");
  }

  return data;
}
