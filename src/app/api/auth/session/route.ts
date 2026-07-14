import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { getAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;

  if (!raw) {
    return NextResponse.json({ userId: null });
  }

  const userId = await verifySessionToken(raw);
  if (!userId) {
    return NextResponse.json({ userId: null });
  }

  // DB-level verification: confirm a merchant row exists for this userId
  try {
    const admin = getAdminClient();
    if (admin) {
      const { data } = await (admin.from("merchants") as any)
        .select("id")
        .eq("id", userId)
        .maybeSingle();
      if (!data) {
        // Merchant was deleted — session is invalid
        return NextResponse.json({ userId: null });
      }
    }
  } catch {
    // DB unavailable — rely on cookie auth alone (fail open)
  }

  return NextResponse.json({ userId });
}
