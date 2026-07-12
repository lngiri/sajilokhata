"use client";

import { createClient } from "@/lib/supabase/client";

let supabaseClient: ReturnType<typeof createClient> | null = null;

function getClient() {
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
export async function getMerchantProfile(merchantId: string): Promise<any> {
  const { data, error } = await getClient()
    .from("merchants")
    .select("*")
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
  }
): Promise<any> {
  const { data, error } = await getClient()
    .from("merchants")
    .upsert({ id: merchantId, ...updates }, { onConflict: "id" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================================
// Customer Linking
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function findOrCreateCustomer(
  phone: string,
  name?: string
): Promise<any> {
  let { data: customer } = await getClient()
    .from("customers")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();

  if (!customer) {
    const { data: newCustomer, error } = await getClient()
      .from("customers")
      .insert({ phone, name: name || null })
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
  if (!log.merchant_id || !log.customer_id) {
    throw new Error("merchant_id and customer_id are required");
  }
  if (!log.amount || typeof log.amount !== "number" || log.amount <= 0) {
    throw new Error("amount must be a positive number");
  }
  if (!log.type || !["debit", "credit"].includes(log.type)) {
    throw new Error("type must be 'debit' or 'credit'");
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
  }
): Promise<any[]> {
  let query = getClient()
    .from("credit_logs")
    .select("*, customers(name, phone)")
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateCreditLogStatus(
  logId: string,
  status: "approved" | "disputed" | "rejected" | "pending" | "unverified",
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

  const { data: userData } = await getClient().auth.getUser();
  const actorId = userData?.user?.id || null;

  await getClient().from("audit_logs").insert({
    credit_log_id: logId,
    action: status,
    actor_type: actorType || "merchant",
    actor_id: actorId,
  });

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
export async function createManualCreditLog(params: {
  merchant_id: string;
  customer_id: string;
  amount: number;
  type: "debit" | "credit";
  description?: string | null;
}): Promise<any> {
  return createCreditLog({
    ...params,
    status: "unverified",
    sync_status: "online",
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
    .eq("status", "approved");

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
  const { data, error } = await getClient()
    .from("merchants")
    .select("id, name, business_name, business_type, phone")
    .eq("phone", phone)
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
  const { data: customers } = await getClient()
    .from("customers")
    .select("id")
    .eq("phone", customerPhone);

  if (!customers || customers.length === 0) return null;

  const customerIds = customers.map((c: any) => c.id);

  // Get all merchant relationships with credit limit and merchant info
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: relationships, error } = (await getClient()
    .from("merchant_customers")
    .select("credit_limit, merchants(id, name, business_name)")
    .in("customer_id", customerIds)) as any;

  if (error) throw error;

  // Compute actual balance from approved credit_logs (source of truth)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: approvedLogs } = await getClient()
    .from("credit_logs")
    .select("merchant_id, amount, type")
    .in("customer_id", customerIds)
    .eq("status", "approved") as unknown as { data: any[] | null };

  const balanceByMerchant: Record<string, number> = {};
  for (const log of approvedLogs || []) {
    const sign = log.type === "debit" ? 1 : -1;
    balanceByMerchant[log.merchant_id] = (balanceByMerchant[log.merchant_id] || 0) + sign * log.amount;
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
  const { data: customers } = await getClient()
    .from("customers")
    .select("id, name")
    .eq("phone", customerPhone);

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
// Delivery Customers
// ============================================================

/**
 * Parse a PostGIS GeoJSON geography point into lat/lng.
 * PostGIS GEOGRAPHY(POINT, 4326) is returned as GeoJSON:
 *   { "type": "Point", "coordinates": [lng, lat] }
 */
function parseGeoPoint(geo: unknown): { lat: number; lng: number } | null {
  if (!geo) return null;
  try {
    const parsed = typeof geo === "string" ? JSON.parse(geo) : geo;
    if (
      parsed?.type === "Point" &&
      Array.isArray(parsed.coordinates) &&
      parsed.coordinates.length === 2
    ) {
      return { lng: parsed.coordinates[0], lat: parsed.coordinates[1] };
    }
  } catch {
    // Invalid GeoJSON
  }
  return null;
}

/**
 * Fetch customers linked to a merchant, with their home GPS coordinates.
 * Used by the Delivery Dashboard for route planning and geofencing.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getDeliveryCustomers(
  merchantId: string
): Promise<any[]> {
  const { data, error } = await getClient()
    .from("merchant_customers")
    .select("*, customers!inner(id, name, phone, home_location_gps)")
    .eq("merchant_id", merchantId);

  if (error) throw error;

  // Convert PostGIS GeoJSON to lat/lng for client-side use
  return (data || []).map((mc: any) => ({
    ...mc,
    home_location: mc.customers?.home_location_gps
      ? parseGeoPoint(mc.customers.home_location_gps)
      : null,
  }));
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
  const { data: approvedLogs } = await getClient()
    .from("credit_logs")
    .select("amount, type, created_at")
    .eq("merchant_id", merchantId)
    .eq("status", "approved") as any;

  const today = new Date().toISOString().split("T")[0];

  const totalOutstanding = approvedLogs?.reduce((sum: number, l: any) => sum + (l.type === "debit" ? l.amount : -l.amount), 0) || 0;
  const totalCreditLimit = customers?.reduce((sum: number, c: any) => sum + (c.credit_limit || 0), 0) || 0;
  const pendingCount = pendingLogs?.length || 0;
  const todayTotal = approvedLogs?.reduce((sum: number, l: any) => {
    if (!l.created_at?.startsWith(today)) return sum;
    return sum + (l.type === "debit" ? l.amount : -l.amount);
  }, 0) || 0;

  return { totalOutstanding, totalCreditLimit, customerCount: customers?.length || 0, pendingCount, todayTotal };
}

// ============================================================
// Analytics & Reports
// ============================================================

export interface AnalyticsResult {
  totalOutstanding: number;
  totalReceived: number;
  netCashFlow: number;
  topCustomers: { name: string; phone: string; balance: number }[];
  dailyBreakdown: { date: string; debit: number; credit: number }[];
}

export async function getMerchantAnalytics(
  merchantId: string,
  dateFrom?: string,
  dateTo?: string
): Promise<AnalyticsResult> {
  let query = getClient()
    .from("credit_logs")
    .select("amount, type, created_at, customers!inner(name, phone)")
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
  const customerBal: Record<string, { name: string; phone: string; balance: number }> = {};
  const dailyMap: Record<string, { debit: number; credit: number }> = {};

  for (const l of rows) {
    if (l.type === "debit") {
      totalOutstanding += l.amount;
    } else {
      totalReceived += l.amount;
    }

    const cusKey = l.customers?.phone || "unknown";
    if (!customerBal[cusKey]) {
      customerBal[cusKey] = {
        name: l.customers?.name || cusKey,
        phone: cusKey,
        balance: 0,
      };
    }
    customerBal[cusKey].balance += l.type === "debit" ? l.amount : -l.amount;

    const day = l.created_at?.split("T")[0] || "unknown";
    if (!dailyMap[day]) dailyMap[day] = { debit: 0, credit: 0 };
    if (l.type === "debit") dailyMap[day].debit += l.amount;
    else dailyMap[day].credit += l.amount;
  }

  const topCustomers = Object.values(customerBal)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 5);

  const dailyBreakdown = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({ date, ...vals }));

  return {
    totalOutstanding,
    totalReceived,
    netCashFlow: totalReceived - totalOutstanding,
    topCustomers,
    dailyBreakdown,
  };
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
  customers: { name: string | null; phone: string } | null;
} | null> {
  const { data, error } = await getClient()
    .from("credit_logs")
    .select("id, amount, type, status, description, customer_id, customers(name, phone)")
    .eq("verification_token", token)
    .maybeSingle();

  if (error) throw error;
  return data as any;
}

export async function approveByToken(
  token: string
): Promise<any> {
  const { data: log } = await getClient()
    .from("credit_logs")
    .select("id")
    .eq("verification_token", token)
    .maybeSingle();

  if (!log) throw new Error("Invalid verification token");

  return updateCreditLogStatus(log.id, "approved", "customer");
}

export async function disputeByToken(
  token: string,
  reason: string
): Promise<any> {
  const { data: log } = await getClient()
    .from("credit_logs")
    .select("id")
    .eq("verification_token", token)
    .maybeSingle();

  if (!log) throw new Error("Invalid verification token");

  await getClient()
    .from("credit_logs")
    .update({ disputed_reason: reason })
    .eq("id", log.id);

  return updateCreditLogStatus(log.id, "disputed", "customer");
}
