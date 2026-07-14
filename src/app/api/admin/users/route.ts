import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/admin-session";
import { getAdminClient } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const raw = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!raw || !(await verifyAdminSessionToken(raw))) {
    return NextResponse.json([], { status: 401 });
  }

  const admin = getAdminClient();
  if (!admin) return NextResponse.json([]);

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";

    let query = (admin.from("merchants") as any)
      .select("id, name, business_name, phone, created_at, status")
      .limit(200)
      .order("created_at", { ascending: false });

    if (search) {
      query = query.or(`name.ilike.%${search}%,business_name.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data } = await query;
    if (!data) return NextResponse.json([]);

    const result = await Promise.all(
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

    return NextResponse.json(result);
  } catch {
    return NextResponse.json([]);
  }
}

export async function PATCH(req: Request) {
  const cookieStore = await cookies();
  const raw = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!raw || !(await verifyAdminSessionToken(raw))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { merchantId, status } = await req.json();
    if (!merchantId) return NextResponse.json({ error: "merchantId required" }, { status: 400 });

    const admin = getAdminClient();
    if (!admin) return NextResponse.json({ error: "Server config" }, { status: 500 });

    const newStatus = status === "suspended" ? "active" : "suspended";
    await (admin.from("merchants") as any)
      .update({ status: newStatus })
      .eq("id", merchantId);

    return NextResponse.json({ success: true, newStatus });
  } catch {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
