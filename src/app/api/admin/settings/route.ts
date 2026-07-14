import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/admin-session";
import { getAdminClient } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const raw = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!raw || !(await verifyAdminSessionToken(raw))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });

  try {
    const admin = getAdminClient();
    if (!admin) return NextResponse.json({ value: null });

    const { data } = await (admin.from("app_settings") as any)
      .select("value")
      .eq("key", key)
      .maybeSingle();

    return NextResponse.json({ value: data?.value ?? null });
  } catch {
    return NextResponse.json({ value: null });
  }
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const raw = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!raw || !(await verifyAdminSessionToken(raw))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { key, value } = await req.json();
    if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });

    const admin = getAdminClient();
    if (!admin) return NextResponse.json({ error: "Server config" }, { status: 500 });

    await (admin.from("app_settings") as any).upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
