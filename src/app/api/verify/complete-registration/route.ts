import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/phone";

/**
 * POST /api/verify/complete-registration
 * Finalize customer registration: update profile + mark as registered + mark invite used
 */
export async function POST(req: NextRequest) {
  try {
    const { phone, name, address } = await req.json();
    if (!phone || !name) {
      return NextResponse.json({ error: "Phone and name required" }, { status: 400 });
    }

    const normalized = normalizePhone(phone);
    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Server config" }, { status: 500 });
    }

    // Verify that OTP was actually confirmed (invite must be marked as used)
    const { data: usedInvite } = await (admin.from("customer_invites") as any)
      .select("id")
      .eq("phone", normalized)
      .not("used_at", "is", null)
      .order("used_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!usedInvite) {
      return NextResponse.json({ success: false, error: "Please verify your phone number first" }, { status: 403 });
    }

    // Find customer by phone
    const { data: customer } = await (admin.from("customers") as any)
      .select("id")
      .eq("phone", normalized)
      .maybeSingle();

    if (!customer) {
      return NextResponse.json({ success: false, error: "Customer not found" }, { status: 404 });
    }

    // Update customer profile + registration status
    const updatePayload: Record<string, any> = {
      name: name.trim(),
      registration_status: "registered",
    };
    if (address) {
      updatePayload.address = address.trim();
    }

    const { error: updateError } = await (admin.from("customers") as any)
      .update(updatePayload)
      .eq("id", customer.id);

    if (updateError) {
      console.error("[complete-registration] update error:", updateError);
      return NextResponse.json({ success: false, error: "Failed to update profile" }, { status: 500 });
    }

    // Mark the invite as used
    await (admin.from("customer_invites") as any)
      .update({ used_at: new Date().toISOString() })
      .eq("phone", normalized)
      .is("used_at", null);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[complete-registration] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
