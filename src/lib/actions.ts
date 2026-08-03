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
// Merchant Profile
// ============================================================

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
// Cash Sales
// ============================================================

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
  initiated_by: string | null;
  proposed_amount: number | null;
  customers: { name: string | null; phone: string; address: string } | null;
  merchants: { name: string | null } | null;
} | null> {
  const res = await fetch("/api/verify/lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to load entry");
  }

  return (data.log as any) || null;
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

// ============================================================
// Credit Limit Check (token-based, works for customers too)
// ============================================================

export async function getVerifyCreditCheck(
  token: string
): Promise<{
  balance: number | null;
  creditLimit: number | null;
  remainingLimit: number | null;
  overLimit: boolean;
} | null> {
  const res = await fetch("/api/verify/credit-check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Failed to check credit limit");
  }

  return data;
}
