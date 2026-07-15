import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { getAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;

  if (!raw) {
    return NextResponse.json({ userId: null, forceLogout: false, roles: [] });
  }

  const userId = await verifySessionToken(raw);
  if (!userId) {
    return NextResponse.json({ userId: null, forceLogout: false, roles: [] });
  }

  // DB-level verification: check merchants + customers tables
  try {
    const admin = getAdminClient();
    if (admin) {
      const [mRes, cRes] = await Promise.all([
        (admin.from("merchants") as any)
          .select("id, force_logout_at")
          .eq("id", userId)
          .maybeSingle(),
        (admin.from("customers") as any)
          .select("id")
          .eq("id", userId)
          .maybeSingle(),
      ]);

      const isMerchant = !!mRes?.data?.id;
      const isCustomer = !!cRes?.data?.id;

      if (!isMerchant && !isCustomer) {
        return NextResponse.json({ userId: null, forceLogout: false, roles: [] });
      }

      // If an admin force-logged-out this merchant, invalidate the session
      if (mRes?.data?.force_logout_at) {
        return NextResponse.json({ userId: null, forceLogout: true, roles: [] });
      }

      const roles: ("merchant" | "customer")[] = [];
      if (isMerchant) roles.push("merchant");
      if (isCustomer) roles.push("customer");

      return NextResponse.json({ userId, forceLogout: false, roles });
    }
  } catch {
    // DB unavailable — rely on cookie auth alone (fail open)
  }

  return NextResponse.json({ userId, forceLogout: false, roles: ["merchant"] });
}
