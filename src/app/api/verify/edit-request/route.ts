import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const { token, proposedAmount } = await req.json();
    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }
    if (!proposedAmount || proposedAmount <= 0) {
      return NextResponse.json({ error: "Proposed amount must be greater than 0" }, { status: 400 });
    }

    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const { data: rawLog, error: fetchError } = await (admin.from("credit_logs") as any)
      .select("id, amount, merchant_id, status")
      .eq("verification_token", token)
      .maybeSingle();

    const log = rawLog as unknown as { id: string; amount: number; merchant_id: string; status: string } | null;

    if (fetchError || !log) {
      return NextResponse.json({ error: "Invalid verification token" }, { status: 400 });
    }

    if (log.status !== "unverified") {
      return NextResponse.json({ error: "Transaction already processed" }, { status: 400 });
    }

    const { error: updateError } = await (admin.from("credit_logs") as any)
      .update({
        status: "edit_requested",
        proposed_amount: proposedAmount,
      })
      .eq("id", log.id);

    if (updateError) throw updateError;

    await admin.from("notifications").insert({
      user_id: log.merchant_id,
      user_type: "merchant",
      type: "edit_requested",
      title: "Customer requested amount change",
      body: `From Rs. ${Number(log.amount).toLocaleString()} to Rs. ${Number(proposedAmount).toLocaleString()}`,
      reference_id: log.id,
      reference_type: "credit_log",
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to submit edit request" }, { status: 500 });
  }
}
