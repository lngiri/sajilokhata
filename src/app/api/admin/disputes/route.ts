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
    const { data: logs } = await (admin.from("credit_logs") as any)
      .select("id, merchant_id, customer_id, amount, description, disputed_reason, status, created_at")
      .in("status", ["disputed", "edit_requested"])
      .order("created_at", { ascending: false })
      .limit(50);

    if (!logs) return NextResponse.json([]);

    const result = await Promise.all(
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

    return NextResponse.json(result);
  } catch {
    return NextResponse.json([]);
  }
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const raw = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!raw || !(await verifyAdminSessionToken(raw))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { logId } = await req.json();
    if (!logId) return NextResponse.json({ error: "logId required" }, { status: 400 });

    const admin = getAdminClient();
    if (!admin) return NextResponse.json({ error: "Server config" }, { status: 500 });

    await (admin.from("credit_logs") as any)
      .update({ status: "approved", disputed_reason: null })
      .eq("id", logId)
      .in("status", ["disputed", "edit_requested"]);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to resolve" }, { status: 500 });
  }
}
