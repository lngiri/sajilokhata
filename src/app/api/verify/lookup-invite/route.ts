import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/phone";

/**
 * POST /api/verify/lookup-invite
 * Check if a customer has a pending registration invite
 */
export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();
    if (!phone) {
      return NextResponse.json({ error: "Phone required" }, { status: 400 });
    }

    const normalized = normalizePhone(phone);
    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Server config" }, { status: 500 });
    }

    // Find customer by phone
    const { data: customer } = await (admin.from("customers") as any)
      .select("id, name, phone, registration_status")
      .eq("phone", normalized)
      .maybeSingle();

    if (!customer) {
      return NextResponse.json({ invite: null });
    }

    // Check for unused invite
    const { data: invite } = await (admin.from("customer_invites") as any)
      .select("id, customer_id, merchant_id, expires_at, created_at")
      .eq("phone", normalized)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      invite: invite ? {
        id: invite.id,
        customerId: invite.customer_id,
        merchantId: invite.merchant_id,
        expiresAt: invite.expires_at,
        createdAt: invite.created_at,
        customerName: customer.name,
        registrationStatus: customer.registration_status,
      } : null,
    });
  } catch (err) {
    console.error("[lookup-invite] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
