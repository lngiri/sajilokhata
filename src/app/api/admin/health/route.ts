import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/admin-session";
import { getAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!raw || !(await verifyAdminSessionToken(raw))) {
    return NextResponse.json({ status: "red", message: "Unauthorized" }, { status: 401 });
  }

  const checks: { label: string; ok: boolean; detail?: string }[] = [];

  try {
    const admin = getAdminClient();
    if (!admin) {
      checks.push({ label: "Supabase Admin Client", ok: false, detail: "Missing SUPABASE_SERVICE_ROLE_KEY" });
    } else {
      const { data } = await (admin.from("merchants") as any).select("id").limit(1);
      checks.push({ label: "Database Connection", ok: true });
    }
  } catch (err) {
    checks.push({ label: "Database Connection", ok: false, detail: String(err) });
  }

  const requiredVars = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
  for (const v of requiredVars) {
    if (!process.env[v]) {
      checks.push({ label: `Environment: ${v}`, ok: false, detail: "Not configured" });
    }
  }

  const failures = checks.filter((c) => !c.ok).length;
  const status = failures === 0 ? "green" : failures <= 2 ? "yellow" : "red";
  const message = status === "green" ? "All systems operational" : `${failures} issue(s) detected`;

  return NextResponse.json({ status, message, lastCheck: new Date().toISOString(), checks });
}
