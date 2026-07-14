import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/admin-session";
import { getAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!raw || !(await verifyAdminSessionToken(raw))) {
    return NextResponse.json([], { status: 401 });
  }

  const admin = getAdminClient();
  if (!admin) return NextResponse.json([]);

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: recent } = await (admin.from("credit_logs") as any)
      .select("merchant_id, created_at")
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
        severity: count >= 50 ? "high" : "medium",
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

    return NextResponse.json(alerts.slice(0, 50));
  } catch {
    return NextResponse.json([]);
  }
}
