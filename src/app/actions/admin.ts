"use server";

import { cookies } from "next/headers";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  createAdminSessionToken,
  verifyAdminSessionToken,
  ADMIN_SESSION_COOKIE,
} from "@/lib/admin-session";

// ── Helper: verify admin session before any DB operation ──
async function requireAdmin(): Promise<string> {
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
      secure: true,
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
  } catch {
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
  } catch {
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
// User Directory
// ──────────────────────────────────────────────

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

    return await Promise.all(
      data.map(async (m: any) => {
        const { count } = await (admin.from("credit_logs") as any)
          .select("id", { count: "exact", head: true })
          .eq("merchant_id", m.id);

        return {
          id: m.id,
          name: m.name || "",
          businessName: m.business_name || "",
          phone: m.phone || "",
          status: m.status || "active",
          transactionCount: count ?? 0,
          createdAt: m.created_at,
        };
      })
    );
  } catch {
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

  const failures = checks.filter((c) => !c.ok).length;
  const status = failures === 0 ? "green" : failures <= 2 ? "yellow" : "red";
  return { status, message: status === "green" ? "All systems operational" : `${failures} issue(s) detected`, lastCheck: new Date().toISOString(), checks };
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
