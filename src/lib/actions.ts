"use client";

import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

// ============================================================
// Merchant Actions
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getMerchantProfile(merchantId: string): Promise<any> {
  const { data, error } = await supabase
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
  updates: { name?: string; business_name?: string; address?: string }
): Promise<any> {
  const { data, error } = await supabase
    .from("merchants")
    .update(updates)
    .eq("id", merchantId)
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
  let { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("phone", phone)
    .single();

  if (!customer) {
    const { data: newCustomer, error } = await supabase
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
  const { data: existing } = await supabase
    .from("merchant_customers")
    .select("*")
    .eq("merchant_id", merchantId)
    .eq("customer_id", customerId)
    .single();

  if (existing) return existing;

  const { data, error } = await supabase
    .from("merchant_customers")
    .insert({
      merchant_id: merchantId,
      customer_id: customerId,
      credit_limit: creditLimit,
      current_balance: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================================
// Credit Logs
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createCreditLog(log: Record<string, any>): Promise<any> {
  const { data, error } = await supabase
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
  }
): Promise<any[]> {
  let query = supabase
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
  status: "approved" | "disputed" | "rejected"
): Promise<any> {
  const updates: Record<string, unknown> = { status };
  if (status === "approved") {
    updates.approved_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("credit_logs")
    .update(updates)
    .eq("id", logId)
    .select()
    .single();

  if (error) throw error;

  await supabase.from("audit_logs").insert({
    credit_log_id: logId,
    action: status,
    actor_type: "merchant",
  });

  return data;
}

// ============================================================
// Customer Summary
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getMerchantCustomers(merchantId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from("merchant_customers")
    .select("*, customers(id, name, phone)")
    .eq("merchant_id", merchantId)
    .order("current_balance", { ascending: false });

  if (error) throw error;
  return data || [];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateCustomerCreditLimit(
  merchantId: string,
  customerId: string,
  creditLimit: number
): Promise<any> {
  const { data, error } = await supabase
    .from("merchant_customers")
    .update({ credit_limit: creditLimit })
    .eq("merchant_id", merchantId)
    .eq("customer_id", customerId)
    .select()
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
  const { data, error } = await supabase
    .from("merchants")
    .select("id, name, business_name, business_type, phone")
    .eq("phone", phone)
    .maybeSingle();

  if (error) throw error;
  return data;
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
  }
): Promise<any[]> {
  // First find the customer record(s) by phone
  const { data: customers } = await supabase
    .from("customers")
    .select("id, name")
    .eq("phone", customerPhone);

  if (!customers || customers.length === 0) return [];

  const customerIds = customers.map((c) => c.id);

  let query = supabase
    .from("credit_logs")
    .select("*, customers(name, phone), merchants!inner(id, name, business_name)")
    .in("customer_id", customerIds)
    .order("created_at", { ascending: false });

  if (options?.status) {
    query = query.eq("status", options.status);
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
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getMerchantStats(merchantId: string): Promise<StatsResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: customers } = await supabase
    .from("merchant_customers")
    .select("current_balance, credit_limit")
    .eq("merchant_id", merchantId) as { data: any[] | null };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pendingLogs } = await supabase
    .from("credit_logs")
    .select("id, amount")
    .eq("merchant_id", merchantId)
    .eq("status", "pending") as { data: any[] | null };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: todayLogs } = await supabase
    .from("credit_logs")
    .select("id, amount, type")
    .eq("merchant_id", merchantId)
    .eq("status", "approved")
    .gte("created_at", new Date().toISOString().split("T")[0]) as { data: any[] | null };

  const totalOutstanding =
    customers?.reduce((sum, c) => sum + (c.current_balance || 0), 0) || 0;
  const totalCreditLimit =
    customers?.reduce((sum, c) => sum + (c.credit_limit || 0), 0) || 0;
  const pendingCount = pendingLogs?.length || 0;
  const todayTotal =
    todayLogs?.reduce((sum, l) => {
      return sum + (l.type === "debit" ? l.amount : -l.amount);
    }, 0) || 0;

  return {
    totalOutstanding,
    totalCreditLimit,
    customerCount: customers?.length || 0,
    pendingCount,
    todayTotal,
  };
}
