import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/phone";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let { merchant_id, name, business_name, business_type, address, phone, photo_url } = body;
    if (phone) phone = normalizePhone(phone);

    console.log("[Profile] POST called — body merchant_id:", merchant_id);

    // ── Auth: verify via custom session cookie (works with our custom OTP) ──
    const cookieHeader = request.headers.get("cookie") || "";
    const sessionCookie = parseCookie(cookieHeader, SESSION_COOKIE);
    let sessionUserId: string | null = null;
    if (sessionCookie) {
      sessionUserId = await verifySessionToken(sessionCookie);
      console.log("[Profile] Session cookie valid — userId:", sessionUserId);
    } else {
      console.log("[Profile] No session cookie found");
    }

    if (!merchant_id && !sessionUserId) {
      console.warn("[Profile] No merchant_id provided and no valid session");
      return NextResponse.json(
        { error: "Not logged in" },
        { status: 401 }
      );
    }

    // ── Use admin client (service_role key bypasses RLS) ──
    const admin = getAdminClient();
    if (!admin) {
      console.error("[Profile] Admin client unavailable — service_role key not configured");
      return NextResponse.json(
        { error: "Server configuration error. Please contact support." },
        { status: 500 }
      );
    }

    // Resolve the merchant ID: prefer the session userId as authoritative
    const resolvedId = sessionUserId || merchant_id;
    console.log("[Profile] Using resolved merchant_id:", resolvedId);

    // Upsert merchant profile — DB UNIQUE constraint on phone prevents duplicates
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin.from("merchants") as any)
      .upsert(
        {
          id: resolvedId,
          ...(name !== undefined && { name }),
          ...(business_name !== undefined && { business_name }),
          ...(business_type !== undefined && { business_type }),
          ...(address !== undefined && { address }),
          ...(phone !== undefined && { phone }),
          ...(photo_url !== undefined && { photo_url }),
        },
        { onConflict: "id" }
      )
      .select()
      .single();

    if (error) {
      console.error("[Profile] Upsert error:", error);
      // Handle unique violation on phone (PostgreSQL error code 23505)
      if (error.code === "23505") {
        return NextResponse.json(
          {
            error: "This number is already registered to another shop. Please use a different number.",
            code: "PHONE_TAKEN",
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Could not save profile. Please try again." },
        { status: 500 }
      );
    }

    console.log("[Profile] Profile saved successfully for merchant:", resolvedId);
    return NextResponse.json({ success: true, profile: data, merchant_id: resolvedId });
  } catch (err) {
    console.error("[Profile] Unexpected error:", err);
    return NextResponse.json(
      { error: "Could not save profile. Please try again." },
      { status: 500 }
    );
  }
}

/** Simple cookie parser — reads a named cookie from a raw Cookie header string */
function parseCookie(cookie: string, name: string): string | null {
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
