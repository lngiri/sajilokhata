import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { getAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;

  console.log("[API::session] Cookie present:", !!raw, "| name:", SESSION_COOKIE);

  if (!raw) {
    console.log("[API::session] No session cookie → returning null userId");
    return NextResponse.json({ userId: null, forceLogout: false, roles: [] });
  }

  const userId = await verifySessionToken(raw);
  console.log("[API::session] Token verify result:", userId ? `userId=${userId}` : "INVALID-TOKEN");

  if (!userId) {
    console.log("[API::session] Invalid/expired token → returning null userId");
    return NextResponse.json({ userId: null, forceLogout: false, roles: [] });
  }

  // DB-level verification: check merchants + customers tables
  try {
    const admin = getAdminClient();
    console.log("[API::session] Admin client available:", !!admin);
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

      console.log("[API::session] DB lookup:", {
        userId,
        isMerchant,
        isCustomer,
        forceLogoutAt: mRes?.data?.force_logout_at,
        merchantError: mRes?.error,
        customerError: cRes?.error,
      });

      if (!isMerchant && !isCustomer) {
        console.log("[API::session] User not found in DB → returning null userId");
        return NextResponse.json({ userId: null, forceLogout: false, roles: [] });
      }

      // If an admin force-logged-out this merchant, invalidate the session
      if (mRes?.data?.force_logout_at) {
        console.log("[API::session] Force logout detected for userId:", userId);
        return NextResponse.json({ userId: null, forceLogout: true, roles: [] });
      }

      const roles: ("merchant" | "customer")[] = [];
      if (isMerchant) roles.push("merchant");
      if (isCustomer) roles.push("customer");

      console.log("[API::session] OK — returning userId:", userId, "roles:", roles);
      return NextResponse.json({ userId, forceLogout: false, roles });
    }
  } catch (err) {
    // DB unavailable — rely on cookie auth alone (fail open)
    console.warn("[API::session] DB lookup failed (fail-open):", err);
  }

  console.log("[API::session] Fallback (no DB or catch) — returning userId from cookie:", userId);
  return NextResponse.json({ userId, forceLogout: false, roles: ["merchant"] });
}
