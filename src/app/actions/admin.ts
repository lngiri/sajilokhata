"use server";

import { cookies } from "next/headers";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  createAdminSessionToken,
  verifyAdminSessionToken,
  ADMIN_SESSION_COOKIE,
} from "@/lib/admin-session";

// ── Helper: verify admin session before any DB operation ──
export async function requireAdmin(): Promise<string> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!raw) throw new Error("Unauthorized");

  const adminId = await verifyAdminSessionToken(raw);
  if (!adminId) throw new Error("Session expired");

  // DB-level check
  const admin = getAdminClient();
  if (admin) {
    const { data } = await (admin.from("admins") as any)
      .select("id")
      .eq("id", adminId)
      .maybeSingle();
    if (!data) throw new Error("Admin not found");
  }

  return adminId;
}

// ──────────────────────────────────────────────
// Auth
// ──────────────────────────────────────────────

export async function adminLogin(
  email: string
): Promise<{ success: boolean; error?: string; name?: string }> {
  const normalized = email.toLowerCase().trim();
  if (!normalized) return { success: false, error: "Email is required" };

  try {
    const admin = getAdminClient();
    if (!admin) return { success: false, error: "Server configuration error" };

    const { data } = await (admin.from("admins") as any)
      .select("id, name, email")
      .eq("email", normalized)
      .maybeSingle();

    if (!data) return { success: false, error: "Unauthorized email" };

    const { token, maxAge } = await createAdminSessionToken(data.id);
    const cookieStore = await cookies();
    cookieStore.set(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge,
      path: "/",
    });

    return { success: true, name: data.name || "Admin" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[AdminLogin]", msg);
    return { success: false, error: "Login failed" };
  }
}

export async function adminSignOut() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
}

export async function getAdminSession(): Promise<{
  id: string | null;
  name?: string;
}> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
    if (!raw) return { id: null };

    const adminId = await verifyAdminSessionToken(raw);
    if (!adminId) return { id: null };

    const admin = getAdminClient();
    if (admin) {
      const { data } = await (admin.from("admins") as any)
        .select("id, name")
        .eq("id", adminId)
        .maybeSingle();
      if (data) return { id: data.id, name: data.name };
    }

    return { id: adminId };
  } catch {
    return { id: null };
  }
}

// ──────────────────────────────────────────────
// Dashboard Stats
// ──────────────────────────────────────────────

export async function getAdminStats(): Promise<{
  totalMerchants: number;
  totalCustomers: number;
  activeTransactions: number;
}> {
  try {
    await requireAdmin();
    const admin = getAdminClient();
    if (!admin) return { totalMerchants: 0, totalCustomers: 0, activeTransactions: 0 };

    const [mRes, cRes, tRes] = await Promise.all([
      (admin.from("merchants") as any).select("id", { count: "exact", head: true }),
      (admin.from("customers") as any).select("id", { count: "exact", head: true }),
      (admin.from("credit_logs") as any)
        .select("id", { count: "exact", head: true })
        .in("status", ["pending", "unverified"]),
    ]);

    return {
      totalMerchants: mRes.count ?? 0,
      totalCustomers: cRes.count ?? 0,
      activeTransactions: tRes.count ?? 0,
    };
  } catch (err) {
    console.error("[getAdminStats]", err);
    return { totalMerchants: 0, totalCustomers: 0, activeTransactions: 0 };
  }
}

// ──────────────────────────────────────────────
// Alerts (Anomaly Detection)
// ──────────────────────────────────────────────

export async function getAdminAlerts(): Promise<
  { id: string; merchantName: string; type: string; message: string; severity: "high" | "medium" | "low"; createdAt: string }[]
> {
  try {
    await requireAdmin();
    const admin = getAdminClient();
    if (!admin) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: recent } = await (admin.from("credit_logs") as any)
      .select("merchant_id")
      .gte("created_at", today.toISOString())
      .limit(2000);

    const counts: Record<string, number> = {};
    if (recent) {
      for (const row of recent) {
        counts[row.merchant_id] = (counts[row.merchant_id] || 0) + 1;
      }
    }

    const alerts: any[] = [];

    for (const [mId, count] of Object.entries(counts)) {
      if (count < 20) continue;
      const { data: m } = await (admin.from("merchants") as any)
        .select("name, business_name")
        .eq("id", mId)
        .maybeSingle();

      alerts.push({
        id: `vol_${mId}`,
        merchantName: m?.business_name || m?.name || mId,
        type: "high_volume",
        message: `${count} transactions today — unusually high activity`,
        severity: count >= 50 ? "high" : ("medium" as "high" | "medium"),
        createdAt: today.toISOString(),
      });
    }

    const { data: disputes } = await (admin.from("credit_logs") as any)
      .select("id, merchant_id, disputed_reason, created_at")
      .eq("status", "disputed")
      .order("created_at", { ascending: false })
      .limit(10);

    if (disputes) {
      for (const d of disputes) {
        const { data: m } = await (admin.from("merchants") as any)
          .select("name, business_name")
          .eq("id", d.merchant_id)
          .maybeSingle();

        alerts.push({
          id: `dis_${d.id}`,
          merchantName: m?.business_name || m?.name || d.merchant_id,
          type: "dispute",
          message: d.disputed_reason || "Transaction disputed",
          severity: "high",
          createdAt: d.created_at,
        });
      }
    }

    return alerts.slice(0, 50);
  } catch (err) {
    console.error("[getAdminAlerts]", err);
    return [];
  }
}

// ──────────────────────────────────────────────
// Disputes
// ──────────────────────────────────────────────

export async function getAdminDisputes(): Promise<
  { id: string; merchantName: string; merchantPhone: string; customerName: string; amount: number; description: string; reason: string; status: string; createdAt: string }[]
> {
  try {
    await requireAdmin();
    const admin = getAdminClient();
    if (!admin) return [];

    const { data: logs } = await (admin.from("credit_logs") as any)
      .select("id, merchant_id, customer_id, amount, description, disputed_reason, status, created_at")
      .in("status", ["disputed", "edit_requested"])
      .order("created_at", { ascending: false })
      .limit(50);

    if (!logs) return [];

    return await Promise.all(
      logs.map(async (log: any) => {
        const [mRes, cRes] = await Promise.all([
          (admin.from("merchants") as any).select("name, business_name, phone").eq("id", log.merchant_id).maybeSingle(),
          (admin.from("customers") as any).select("name, phone").eq("id", log.customer_id).maybeSingle(),
        ]);
        return {
          id: log.id,
          merchantName: mRes?.business_name || mRes?.name || log.merchant_id,
          merchantPhone: mRes?.phone || "",
          customerName: cRes?.name || cRes?.phone || log.customer_id || "Walk-in",
          amount: log.amount,
          description: log.description || "",
          reason: log.disputed_reason || "Edit requested",
          status: log.status,
          createdAt: log.created_at,
        };
      })
    );
  } catch {
    return [];
  }
}

export async function resolveDispute(logId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    const admin = getAdminClient();
    if (!admin) return { success: false, error: "Server config error" };

    await (admin.from("credit_logs") as any)
      .update({ status: "approved", disputed_reason: null })
      .eq("id", logId)
      .in("status", ["disputed", "edit_requested"]);

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

// ──────────────────────────────────────────────
// User Directory — unified (merchants + customers)
// ──────────────────────────────────────────────
// Normalize phone to consistent 10-digit format
// Strips non-numeric chars, removes country prefix (977), returns last 10 digits
function normalizePhone(phone: string): string {
  if (!phone) return "";
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("977") && digits.length > 10) digits = digits.slice(3);
  if (digits.length > 10) digits = digits.slice(-10);
  return digits;
}

// ──────────────────────────────────────────────

export interface DirectoryUser {
  id: string;
  name: string;
  phone: string;
  role: "merchant" | "customer" | "both";
  businessName: string;
  status: string;
  transactionCount: number;
  createdAt: string;
}

export async function getAdminUserDirectory(search?: string): Promise<DirectoryUser[]> {
  try {
    await requireAdmin();
    const admin = getAdminClient();
    if (!admin) return [];

    let results: DirectoryUser[] = [];

    // Try SQL RPC first (JOIN-based role detection)
    try {
      const { data: rows, error } = await (admin.rpc("get_user_directory_safe") as any);
      if (!error && Array.isArray(rows) && rows.length > 0) {
        console.log("[getAdminUserDirectory] RPC returned", rows.length, "rows");
        if (rows.length > 0) console.log("[getAdminUserDirectory] First row:", JSON.stringify(rows[0]));
        results = rows.map((r: any) => ({
          id: r.id,
          name: r.name || "",
          phone: normalizePhone(r.phone || ""),
          role: (r.role === "both" ? "both" : r.role === "customer" ? "customer" : "merchant") as "merchant" | "customer" | "both",
          businessName: r.business_name || "",
          status: "active",
          transactionCount: 0,
          createdAt: r.created_at,
        }));
      } else {
        console.warn("[getAdminUserDirectory] RPC failed or empty, falling back to JS:", error);
      }
    } catch (rpcErr) {
      console.warn("[getAdminUserDirectory] RPC exception, falling back to JS:", rpcErr);
    }

    // Fallback: JS-based approach if RPC didn't return data
    if (results.length === 0) {
      console.log("[getAdminUserDirectory] Using JS fallback");

      const [mRes, cRes] = await Promise.all([
        (admin.from("merchants") as any)
          .select("id, name, business_name, phone, created_at")
          .limit(500)
          .order("created_at", { ascending: false }),
        (admin.from("customers") as any)
          .select("id, name, phone, created_at")
          .limit(500)
          .order("created_at", { ascending: false }),
      ]);

      const merchants: any[] = mRes?.data ?? [];
      const customers: any[] = cRes?.data ?? [];
      console.log("[getAdminUserDirectory] JS fallback: merchants=", merchants.length, "customers=", customers.length);

      const merchantPhones = new Set<string>();
      for (const m of merchants) {
        const np = normalizePhone(m.phone);
        if (np) merchantPhones.add(np);
      }
      const customerPhones = new Set<string>();
      for (const c of customers) {
        const np = normalizePhone(c.phone);
        if (np) customerPhones.add(np);
      }

      const combined = new Map<string, DirectoryUser>();

      for (const m of merchants) {
        const np = normalizePhone(m.phone);
        combined.set(m.id, {
          id: m.id,
          name: m.name || m.business_name || "",
          phone: np,
          role: np && customerPhones.has(np) ? "both" : "merchant",
          businessName: m.business_name || "",
          status: "active",
          transactionCount: 0,
          createdAt: m.created_at,
        });
      }

      for (const c of customers) {
        const np = normalizePhone(c.phone);
        if (!combined.has(c.id)) {
          combined.set(c.id, {
            id: c.id,
            name: c.name || "",
            phone: np,
            role: np && merchantPhones.has(np) ? "both" : "customer",
            businessName: "",
            status: "active",
            transactionCount: 0,
            createdAt: c.created_at,
          });
        } else {
          const existing = combined.get(c.id)!;
          existing.role = "both";
        }
      }

      results = Array.from(combined.values());
    }

    // Add tx counts for merchants
    const merchantIds = results
      .filter((u) => u.role === "merchant" || u.role === "both")
      .map((u) => u.id);

    if (merchantIds.length > 0) {
      try {
        const { data: txCounts } = await (admin.from("credit_logs") as any)
          .select("merchant_id, id")
          .in("merchant_id", merchantIds);

        if (txCounts) {
          const countMap: Record<string, number> = {};
          for (const tx of txCounts) {
            countMap[tx.merchant_id] = (countMap[tx.merchant_id] || 0) + 1;
          }
          results = results.map((u) => ({
            ...u,
            transactionCount: countMap[u.id] || 0,
          }));
        }
      } catch (e) {
        console.error("[getAdminUserDirectory] tx counts query failed:", e);
      }
    }

    // ── Dedup by normalized phone ──
    const dedupMap = new Map<string, DirectoryUser>();
    for (const user of results) {
      // Normalize phone on RPC results too (might have +977)
      const np = user.phone ? normalizePhone(user.phone) : "";
      if (!np) {
        // No phone — key by id to preserve
        dedupMap.set(`__nophone__${user.id}`, user);
        continue;
      }
      user.phone = np;

      const existing = dedupMap.get(np);
      if (!existing) {
        dedupMap.set(np, { ...user });
      } else {
        // Merge: combine roles, sum tx counts, keep latest createdAt
        const roleSet = new Set([existing.role, user.role]);
        const mergedRole: "merchant" | "customer" | "both" =
          roleSet.has("both") || (roleSet.has("merchant") && roleSet.has("customer"))
            ? "both"
            : roleSet.has("merchant")
              ? "merchant"
              : "customer";

        dedupMap.set(np, {
          ...existing,
          role: mergedRole,
          name: user.name || existing.name,
          businessName: user.businessName || existing.businessName,
          phone: np,
          transactionCount: existing.transactionCount + user.transactionCount,
          status: user.status === "suspended" || existing.status === "suspended" ? "suspended" : "active",
          createdAt: user.createdAt > existing.createdAt ? user.createdAt : existing.createdAt,
        });
      }
    }
    results = Array.from(dedupMap.values());

    if (search) {
      const q = search.toLowerCase();
      results = results.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.phone.includes(q) ||
          u.businessName.toLowerCase().includes(q)
      );
    }

    return results;
  } catch (err) {
    console.error("[getAdminUserDirectory]", err);
    return [];
  }
}

// Legacy — merchants only (used by dashboard)
export async function getAdminMerchants(search?: string): Promise<
  { id: string; name: string; businessName: string; phone: string; status: string; transactionCount: number; createdAt: string }[]
> {
  try {
    await requireAdmin();
    const admin = getAdminClient();
    if (!admin) return [];

    let query = (admin.from("merchants") as any)
      .select("id, name, business_name, phone, created_at, status")
      .limit(200)
      .order("created_at", { ascending: false });

    if (search) {
      query = query.or(`name.ilike.%${search}%,business_name.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data } = await query;
    if (!data) return [];

    const results: any[] = [];
    for (const m of data) {
      let count = 0;
      try {
        const r = await (admin.from("credit_logs") as any)
          .select("id", { count: "exact", head: true })
          .eq("merchant_id", m.id);
        count = r?.count ?? 0;
      } catch (e) {
        console.error("[getAdminMerchants] count failed for", m.id, e);
      }
      results.push({
        id: m.id,
        name: m.name || "",
        businessName: m.business_name || "",
        phone: m.phone || "",
        status: m.status || "active",
        transactionCount: count,
        createdAt: m.created_at,
      });
    }
    return results;
  } catch (err) {
    console.error("[getAdminMerchants]", err);
    return [];
  }
}

export async function toggleMerchantStatus(
  merchantId: string,
  currentStatus: string
): Promise<{ success: boolean; newStatus?: string; error?: string }> {
  try {
    await requireAdmin();
    const admin = getAdminClient();
    if (!admin) return { success: false, error: "Server config" };

    const newStatus = currentStatus === "suspended" ? "active" : "suspended";
    const updates: any = { status: newStatus };
    if (newStatus === "suspended") {
      updates.suspended_at = new Date().toISOString();
    } else {
      updates.suspended_at = null;
    }

    await (admin.from("merchants") as any).update(updates).eq("id", merchantId);
    return { success: true, newStatus };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

export async function bulkSuspendMerchants(
  merchantIds: string[]
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    await requireAdmin();

    if (!merchantIds.length) {
      return { success: false, error: "No merchants selected" };
    }

    const admin = getAdminClient();
    if (!admin) return { success: false, error: "Server config" };

    const updates: Record<string, unknown> = {
      status: "suspended",
      suspended_at: new Date().toISOString(),
    };

    const { error } = await (admin.from("merchants") as any)
      .update(updates)
      .in("id", merchantIds);

    if (error) {
      console.error("[bulkSuspendMerchants] error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, count: merchantIds.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

// ──────────────────────────────────────────────
// Merchant Detail
// ──────────────────────────────────────────────

export async function getAdminMerchantDetail(merchantId: string): Promise<{
  id: string;
  name: string;
  businessName: string;
  phone: string;
  status: string;
  businessType: string;
  address: string;
  createdAt: string;
  transactionCount: number;
  customerCount: number;
} | null> {
  try {
    await requireAdmin();
    const admin = getAdminClient();
    if (!admin) {
      console.error("[getAdminMerchantDetail] getAdminClient returned null");
      return null;
    }

    console.log("[getAdminMerchantDetail] Loading ID:", merchantId);

    let m: any = null;

    // Try RPC first
    try {
      const { data: rows, error } = await (admin.rpc("get_user_directory_safe") as any);
      if (!error && Array.isArray(rows)) {
        m = rows.find((r: any) => r.id === merchantId) || null;
        if (m) console.log("[getAdminMerchantDetail] Found via RPC:", JSON.stringify(m));
      }
    } catch (e) {
      console.warn("[getAdminMerchantDetail] RPC lookup failed:", e);
    }

    // Fallback: direct merchant query
    if (!m) {
      console.log("[getAdminMerchantDetail] Falling back to direct query");
      const { data: merchant } = await (admin.from("merchants") as any)
        .select("*")
        .eq("id", merchantId)
        .maybeSingle();
      m = merchant;
      console.log("[getAdminMerchantDetail] Direct query result:", JSON.stringify(m));
    }

    if (!m) {
      console.error("[getAdminMerchantDetail] No merchant found for ID:", merchantId);
      return null;
    }

    // Get counts with individual try-catch
    let txCount = 0, custCount = 0;
    try {
      const r = await (admin.from("credit_logs") as any)
        .select("id", { count: "exact", head: true })
        .eq("merchant_id", m.id);
      txCount = r?.count ?? 0;
    } catch (e) {
      console.error("[getAdminMerchantDetail] tx count failed:", e);
    }
    try {
      const r = await (admin.from("merchant_customers") as any)
        .select("id", { count: "exact", head: true })
        .eq("merchant_id", m.id);
      custCount = r?.count ?? 0;
    } catch (e) {
      console.error("[getAdminMerchantDetail] cust count failed:", e);
    }

    const result = {
      id: m.id,
      name: m.name || "",
      businessName: m.business_name || "",
      phone: m.phone || "",
      status: m.status || "active",
      businessType: m.business_type || "",
      address: m.address || "",
      createdAt: m.created_at || m.createdAt,
      transactionCount: txCount,
      customerCount: custCount,
    };
    console.log("[getAdminMerchantDetail] Returning:", JSON.stringify(result));
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[getAdminMerchantDetail] Exception:", msg);
    return null;
  }
}

// ──────────────────────────────────────────────
// Storage & Usage
// ──────────────────────────────────────────────

export async function getMerchantStorageUsage(): Promise<
  { id: string; name: string; businessName: string; phone: string; transactionCount: number; customerCount: number; estimatedRows: number }[]
> {
  try {
    await requireAdmin();
    const admin = getAdminClient();
    if (!admin) return [];

    const { data: merchants } = await (admin.from("merchants") as any)
      .select("id, name, business_name, phone")
      .limit(200)
      .order("created_at", { ascending: false });

    if (!merchants) return [];

    const results: any[] = [];
    for (const m of merchants) {
      let txCount = 0, custCount = 0;
      try {
        const r = await (admin.from("credit_logs") as any)
          .select("id", { count: "exact", head: true })
          .eq("merchant_id", m.id);
        txCount = r?.count ?? 0;
      } catch (e) {
        console.error("[getMerchantStorageUsage] tx count failed for", m.id, e);
      }
      try {
        const r = await (admin.from("merchant_customers") as any)
          .select("id", { count: "exact", head: true })
          .eq("merchant_id", m.id);
        custCount = r?.count ?? 0;
      } catch (e) {
        console.error("[getMerchantStorageUsage] cust count failed for", m.id, e);
      }
      results.push({
        id: m.id,
        name: m.name || "",
        businessName: m.business_name || "",
        phone: m.phone || "",
        transactionCount: txCount,
        customerCount: custCount,
        estimatedRows: txCount + custCount,
      });
    }
    return results;
  } catch (err) {
    console.error("[getMerchantStorageUsage]", err);
    return [];
  }
}

// ──────────────────────────────────────────────
// Analytics
// ──────────────────────────────────────────────

export async function getMerchantAnalytics(): Promise<
  { id: string; name: string; businessName: string; phone: string; transactionCount: number; customerCount: number; lastActiveDate: string | null }[]
> {
  try {
    await requireAdmin();
    const admin = getAdminClient();
    if (!admin) return [];

    const { data: merchants } = await (admin.from("merchants") as any)
      .select("id, name, business_name, phone")
      .limit(200);

    if (!merchants) return [];

    const results: any[] = [];
    for (const m of merchants) {
      let txCount = 0, custCount = 0, lastActiveDate: string | null = null;
      try {
        const r = await (admin.from("credit_logs") as any)
          .select("id", { count: "exact", head: true })
          .eq("merchant_id", m.id);
        txCount = r?.count ?? 0;
      } catch (e) {
        console.error("[getMerchantAnalytics] tx count failed for", m.id, e);
      }
      try {
        const r = await (admin.from("merchant_customers") as any)
          .select("id", { count: "exact", head: true })
          .eq("merchant_id", m.id);
        custCount = r?.count ?? 0;
      } catch (e) {
        console.error("[getMerchantAnalytics] cust count failed for", m.id, e);
      }
      try {
        const { data: lastTx } = await (admin.from("credit_logs") as any)
          .select("created_at")
          .eq("merchant_id", m.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        lastActiveDate = lastTx?.created_at ?? null;
      } catch (e) {
        console.error("[getMerchantAnalytics] last tx query failed for", m.id, e);
      }
      results.push({
        id: m.id,
        name: m.name || "",
        businessName: m.business_name || "",
        phone: m.phone || "",
        transactionCount: txCount,
        customerCount: custCount,
        lastActiveDate,
      });
    }
    return results;
  } catch (err) {
    console.error("[getMerchantAnalytics]", err);
    return [];
  }
}

// ──────────────────────────────────────────────
// System Health
// ──────────────────────────────────────────────

export async function getSystemHealth(): Promise<{
  status: "green" | "yellow" | "red";
  message: string;
  lastCheck: string;
  checks: { label: string; ok: boolean; detail?: string }[];
}> {
  const checks: { label: string; ok: boolean; detail?: string }[] = [];

  try {
    await requireAdmin();
  } catch {
    checks.push({ label: "Admin Session", ok: false, detail: "Unauthorized" });
    return { status: "red", message: "Admin session invalid", lastCheck: new Date().toISOString(), checks };
  }

  try {
    const admin = getAdminClient();
    if (!admin) {
      checks.push({ label: "Supabase Admin Client", ok: false, detail: "Missing SUPABASE_SERVICE_ROLE_KEY" });
    } else {
      await (admin.from("merchants") as any).select("id").limit(1);
      checks.push({ label: "Database Connection", ok: true });
    }
  } catch (err) {
    checks.push({ label: "Database Connection", ok: false, detail: String(err) });
  }

  const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
  for (const key of required) {
    if (!process.env[key]) {
      checks.push({ label: `Env: ${key}`, ok: false, detail: "Not set" });
    }
  }

  // ─── SMS Gateway Check ──────────────────────────────────────
  const smsToken = process.env.AAKASH_SMS_TOKEN;
  if (!smsToken) {
    checks.push({ label: "SMS Gateway Token", ok: false, detail: "AAKASH_SMS_TOKEN not set" });
  } else {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 10000);
      const payload = new URLSearchParams({ auth_token: smsToken, to: "9800000000", text: "healthcheck" }).toString();
      const res = await fetch("https://sms.aakashsms.com/sms/v3/send", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: payload,
        signal: controller.signal,
      });
      clearTimeout(t);
      const body = await res.text();
      let parsed: any;
      try { parsed = JSON.parse(body); } catch { parsed = {}; }
      if (parsed?.error === true) {
        checks.push({ label: "SMS Gateway API", ok: false, detail: parsed.message || "API error" });
      } else {
        checks.push({ label: "SMS Gateway API", ok: true });
      }
    } catch (err) {
      checks.push({ label: "SMS Gateway API", ok: false, detail: String(err) });
    }
  }

  const failures = checks.filter((c) => !c.ok).length;
  const status = failures === 0 ? "green" : failures <= 2 ? "yellow" : "red";
  return { status, message: status === "green" ? "All systems operational" : `${failures} issue(s) detected`, lastCheck: new Date().toISOString(), checks };
}

// ──────────────────────────────────────────────
// Session Monitor
// ──────────────────────────────────────────────

export interface SessionRecord {
  sessionId: string;
  deviceInfo: string;
  ipAddress: string;
  loginTime: string;
  lastActive: string;
}

export interface UserSessionResult {
  userId: string;
  name: string;
  businessName: string;
  phone: string;
  userType: "merchant" | "customer" | "both";
  status: string;
  forceLogoutAt: string | null;
  sessions: SessionRecord[];
}

/**
 * Search users (merchants AND customers) by phone or name,
 * then return their active session details from the sessions table.
 */
export async function searchMerchantSession(
  query: string
): Promise<UserSessionResult[]> {
  try {
    await requireAdmin();
    const admin = getAdminClient();
    if (!admin || !query.trim()) return [];

    const clean = query.trim();
    const np = normalizePhone(clean);

    // Collect matching user IDs (merchant IDs for session lookup)
    const userIds = new Set<string>();
    const userMap = new Map<string, {
      name: string;
      businessName: string;
      phone: string;
      status: string;
      forceLogoutAt: string | null;
      isMerchant: boolean;
      isCustomer: boolean;
    }>();

    // 1a. Search merchants by normalized phone
    if (np.length >= 6) {
      const { data } = await (admin.from("merchants") as any)
        .select("id, name, business_name, phone, status, force_logout_at")
        .or(`phone.ilike.%${np}%`)
        .limit(20);
      if (data) {
        for (const m of data) {
          userIds.add(m.id);
          userMap.set(m.id, {
            name: m.name || "",
            businessName: m.business_name || "",
            phone: m.phone || "",
            status: m.status || "active",
            forceLogoutAt: m.force_logout_at || null,
            isMerchant: true,
            isCustomer: false,
          });
        }
      }
    }

    // 1b. If no merchants found by phone, try name/business_name
    if (userIds.size === 0) {
      const { data } = await (admin.from("merchants") as any)
        .select("id, name, business_name, phone, status, force_logout_at")
        .or(`name.ilike.%${clean}%,business_name.ilike.%${clean}%`)
        .limit(20);
      if (data) {
        for (const m of data) {
          userIds.add(m.id);
          userMap.set(m.id, {
            name: m.name || "",
            businessName: m.business_name || "",
            phone: m.phone || "",
            status: m.status || "active",
            forceLogoutAt: m.force_logout_at || null,
            isMerchant: true,
            isCustomer: false,
          });
        }
      }
    }

    // 2. Also search customers by phone or name
    if (np.length >= 6) {
      const { data } = await (admin.from("customers") as any)
        .select("id, name, phone")
        .or(`phone.ilike.%${np}%`)
        .limit(20);
      if (data) {
        for (const c of data) {
          if (userMap.has(c.id)) {
            userMap.get(c.id)!.isCustomer = true;
          } else {
            userIds.add(c.id);
            userMap.set(c.id, {
              name: c.name || "",
              businessName: "",
              phone: c.phone || "",
              status: "active",
              forceLogoutAt: null,
              isMerchant: false,
              isCustomer: true,
            });
          }
        }
      }
    }

    if (userIds.size === 0 && np.length >= 6) {
      const { data } = await (admin.from("customers") as any)
        .select("id, name, phone")
        .or(`name.ilike.%${clean}%`)
        .limit(20);
      if (data) {
        for (const c of data) {
          if (!userMap.has(c.id)) {
            userIds.add(c.id);
            userMap.set(c.id, {
              name: c.name || "",
              businessName: "",
              phone: c.phone || "",
              status: "active",
              forceLogoutAt: null,
              isMerchant: false,
              isCustomer: true,
            });
          }
        }
      }
    }

    if (userIds.size === 0) return [];

    // 3. Query sessions for all found merchant IDs
    const merchantIds = Array.from(userIds);
    const sessionMap = new Map<string, SessionRecord[]>();
    try {
      const { data: sessions } = await (admin.from("sessions") as any)
        .select("id, merchant_id, device_info, ip_address, created_at, last_active")
        .in("merchant_id", merchantIds)
        .order("created_at", { ascending: false });
      if (sessions) {
        for (const s of sessions) {
          const mid = s.merchant_id;
          if (!sessionMap.has(mid)) sessionMap.set(mid, []);
          sessionMap.get(mid)!.push({
            sessionId: s.id,
            deviceInfo: s.device_info || "",
            ipAddress: s.ip_address || "",
            loginTime: s.created_at,
            lastActive: s.last_active,
          });
        }
      }
    } catch (e) {
      console.error("[searchMerchantSession] sessions query failed:", e);
    }

    // 4. Build results
    const results: UserSessionResult[] = [];
    for (const uid of merchantIds) {
      const u = userMap.get(uid);
      if (!u) continue;
      const userType: "merchant" | "customer" | "both" =
        u.isMerchant && u.isCustomer ? "both" :
        u.isMerchant ? "merchant" : "customer";
      results.push({
        userId: uid,
        name: u.name,
        businessName: u.businessName,
        phone: normalizePhone(u.phone),
        userType,
        status: u.status,
        forceLogoutAt: u.forceLogoutAt,
        sessions: sessionMap.get(uid) || [],
      });
    }

    return results;
  } catch (err) {
    console.error("[searchMerchantSession]", err);
    return [];
  }
}

/**
 * Force-logout a user by setting a `force_logout_at` timestamp.
 * Also terminates all their active sessions.
 */
export async function forceMerchantLogout(
  merchantId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    const admin = getAdminClient();
    if (!admin) return { success: false, error: "Server config" };

    await (admin.from("merchants") as any)
      .update({ force_logout_at: new Date().toISOString() })
      .eq("id", merchantId);

    // Also delete their sessions
    try {
      await (admin.from("sessions") as any)
        .delete()
        .eq("merchant_id", merchantId);
    } catch (e) {
      console.error("[forceMerchantLogout] session delete failed:", e);
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Clear a user's force-logout flag so they can log in again.
 */
export async function clearForceLogout(
  merchantId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    const admin = getAdminClient();
    if (!admin) return { success: false, error: "Server config" };

    await (admin.from("merchants") as any)
      .update({ force_logout_at: null })
      .eq("id", merchantId);

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Terminate a single session record. Deletes it from the sessions table.
 */
export async function terminateSession(
  sessionId: string,
  merchantId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    const admin = getAdminClient();
    if (!admin) return { success: false, error: "Server config" };

    await (admin.from("sessions") as any)
      .delete()
      .eq("id", sessionId)
      .eq("merchant_id", merchantId); // safety check

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

// ──────────────────────────────────────────────
// App Settings (Branding, CMS, Announcements)
// ──────────────────────────────────────────────

export async function getAppSetting(key: string): Promise<any> {
  try {
    await requireAdmin();
    const admin = getAdminClient();
    if (!admin) return null;

    const { data } = await (admin.from("app_settings") as any)
      .select("value")
      .eq("key", key)
      .maybeSingle();

    return data?.value ?? null;
  } catch {
    return null;
  }
}

export async function setAppSetting(key: string, value: any): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    const admin = getAdminClient();
    if (!admin) return { success: false, error: "Server config" };

    await (admin.from("app_settings") as any).upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}
