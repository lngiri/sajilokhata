import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { getAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;

  if (!raw) {
    return NextResponse.json({ userId: null, forceLogout: false });
  }

  const userId = await verifySessionToken(raw);
  if (!userId) {
    return NextResponse.json({ userId: null, forceLogout: false });
  }

  // DB-level verification: confirm a merchant row exists and
  // hasn't been force-logged-out by an admin
  try {
    const admin = getAdminClient();
    if (admin) {
      const { data } = await (admin.from("merchants") as any)
        .select("id, force_logout_at")
        .eq("id", userId)
        .maybeSingle();

      if (!data) {
        return NextResponse.json({ userId: null, forceLogout: false });
      }

      // If an admin force-logged-out this merchant, invalidate the session
      if (data.force_logout_at) {
        return NextResponse.json({ userId: null, forceLogout: true });
      }
    }
  } catch {
    // DB unavailable — rely on cookie auth alone (fail open)
  }

  return NextResponse.json({ userId, forceLogout: false });
}
