import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/admin-session";
import { getAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!raw) {
    return NextResponse.json({ authorized: false });
  }

  const adminId = await verifyAdminSessionToken(raw);
  if (!adminId) {
    return NextResponse.json({ authorized: false });
  }

  // DB-level check
  try {
    const admin = getAdminClient();
    if (admin) {
      const { data } = await (admin.from("admins") as any)
        .select("id, name")
        .eq("id", adminId)
        .maybeSingle();
      if (data) {
        return NextResponse.json({ authorized: true, id: data.id, name: data.name });
      }
    }
  } catch {
    // DB unavailable — rely on cookie alone
  }

  return NextResponse.json({ authorized: false });
}
