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
