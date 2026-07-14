import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/admin-session";

export async function GET() {
  // Verify admin session
  const cookieStore = await cookies();
  const raw = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!raw || !(await verifyAdminSessionToken(raw))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ totalMerchants: 0, totalCustomers: 0, activeTransactions: 0 });
  }

  try {
    const [mRes, cRes, tRes] = await Promise.all([
      (admin.from("merchants") as any).select("id", { count: "exact", head: true }),
      (admin.from("customers") as any).select("id", { count: "exact", head: true }),
      (admin.from("credit_logs") as any)
        .select("id", { count: "exact", head: true })
        .in("status", ["pending", "unverified"]),
    ]);

    return NextResponse.json({
      totalMerchants: mRes.count ?? 0,
      totalCustomers: cRes.count ?? 0,
      activeTransactions: tRes.count ?? 0,
    });
  } catch {
    return NextResponse.json({ totalMerchants: 0, totalCustomers: 0, activeTransactions: 0 });
  }
}
