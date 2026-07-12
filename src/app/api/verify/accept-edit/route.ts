import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { logId } = await req.json();
    if (!logId) {
      return NextResponse.json({ error: "logId is required" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: rawLog, error: fetchError } = await supabase
      .from("credit_logs")
      .select("id, amount, proposed_amount, status, merchant_id, customer_id, type")
      .eq("id", logId)
      .single();

    const log = rawLog as unknown as {
      id: string; amount: number; proposed_amount: number | null;
      status: string; merchant_id: string; customer_id: string; type: string;
    } | null;

    if (fetchError || !log) {
      return NextResponse.json({ error: "Credit log not found" }, { status: 404 });
    }

    if (log.status !== "edit_requested" || !log.proposed_amount) {
      return NextResponse.json({ error: "No pending edit request for this transaction" }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from("credit_logs")
      .update({
        amount: log.proposed_amount,
        proposed_amount: null,
        status: "approved",
        approved_at: new Date().toISOString(),
      })
      .eq("id", log.id);

    if (updateError) throw updateError;

    await supabase.from("audit_logs").insert({
      credit_log_id: log.id,
      action: "edit_accepted",
      actor_type: "merchant",
      previous_values: { original_amount: log.amount, new_amount: log.proposed_amount },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to accept edit" }, { status: 500 });
  }
}
