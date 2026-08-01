import { NextResponse } from "next/server";
import { createCustomerSessionToken, CUSTOMER_SESSION_COOKIE_OPTIONS } from "@/lib/session";
import { getAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/phone";

export async function POST(request: Request) {
  try {
    const { phone, name } = await request.json();

    if (!phone || typeof phone !== "string") {
      return NextResponse.json({ error: "Phone number required" }, { status: 400 });
    }

    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    if (cleanPhone.length !== 10) {
      return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
    }

    // A customer who logs in with a verified phone is registered. Mark any
    // leftover "invited" rows (e.g. created before registration_status was
    // set on signup) as registered so merchants don't see a false "Invited —
    // awaiting registration" banner. Idempotent — no-op once already registered.
    try {
      const admin = getAdminClient();
      if (admin) {
        const normalized = normalizePhone(cleanPhone);
        const { data: existing } = await (admin.from("customers") as any)
          .select("id, registration_status")
          .eq("phone", normalized)
          .maybeSingle();
        if (existing?.id && existing.registration_status === "invited") {
          await (admin.from("customers") as any)
            .update({ registration_status: "registered" })
            .eq("id", existing.id);
        }
      }
    } catch (err) {
      console.warn("[Customer Session] registration_status update failed:", err);
    }

    const { token } = await createCustomerSessionToken(cleanPhone, name);

    const response = NextResponse.json({ success: true });
    response.cookies.set("customer_session", token, CUSTOMER_SESSION_COOKIE_OPTIONS);

    return response;
  } catch (err) {
    console.error("[Customer Session] Error creating session:", err);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}