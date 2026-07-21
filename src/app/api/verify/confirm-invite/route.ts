import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/phone";

/**
 * POST /api/verify/confirm-invite
 * Verify OTP code from a registration invite
 */
export async function POST(req: NextRequest) {
  try {
    const { phone, otp } = await req.json();
    if (!phone || !otp) {
      return NextResponse.json({ error: "Phone and OTP required" }, { status: 400 });
    }

    const normalized = normalizePhone(phone);
    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Server config" }, { status: 500 });
    }

    // Find the most recent unused, non-expired invite
    const { data: invite } = await (admin.from("customer_invites") as any)
      .select("id, customer_id, merchant_id, otp, expires_at")
      .eq("phone", normalized)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!invite) {
      return NextResponse.json({ success: false, error: "No valid invite found. Please request a new code." }, { status: 404 });
    }

    // Verify OTP
    if (invite.otp !== otp) {
      return NextResponse.json({ success: false, error: "Invalid code. Please try again." }, { status: 400 });
    }

    // Mark invite as verified (prevent reuse between OTP and profile completion)
    await (admin.from("customer_invites") as any)
      .update({ used_at: new Date().toISOString() })
      .eq("id", invite.id);

    // Get customer name if available
    const { data: customer } = await (admin.from("customers") as any)
      .select("name")
      .eq("id", invite.customer_id)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      customerId: invite.customer_id,
      merchantId: invite.merchant_id,
      name: customer?.name || null,
    });
  } catch (err) {
    console.error("[confirm-invite] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
