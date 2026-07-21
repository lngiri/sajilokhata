import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const { logId } = await req.json();
    if (!logId) {
      return NextResponse.json({ error: "logId is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const admin = getAdminClient();

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

    // Credit limit check — only for debit (credit extended to customer)
    if (log.type === "debit" && log.customer_id && admin) {
      const netIncrease = log.proposed_amount - log.amount;
      if (netIncrease <= 0) {
        // Amount reduced or unchanged — no credit limit concern
      } else {
        const { data: mc } = await (admin.from("merchant_customers") as any)
          .select("credit_limit")
          .eq("merchant_id", log.merchant_id)
          .eq("customer_id", log.customer_id)
          .maybeSingle();

        const creditLimit = (mc as any)?.credit_limit || 0;

        const { data: approvedLogs } = await (admin.from("credit_logs") as any)
          .select("amount, type")
          .eq("merchant_id", log.merchant_id)
          .eq("customer_id", log.customer_id)
          .eq("status", "approved");

        const currentBalance = (approvedLogs as any[])?.reduce((sum: number, l: any) => {
          return sum + (l.type === "debit" ? l.amount : -l.amount);
        }, 0) || 0;

        const remainingLimit = creditLimit - currentBalance;

        if (netIncrease > remainingLimit) {
          return NextResponse.json({
            error: `Credit limit exceeded. Available: Rs. ${remainingLimit.toLocaleString()}, requested increase: Rs. ${netIncrease.toLocaleString()}`,
            code: "CREDIT_LIMIT_EXCEEDED",
          }, { status: 400 });
        }
      }
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

    if (admin && log.customer_id) {
      await admin.from("notifications").insert({
        user_id: log.customer_id,
        user_type: "customer",
        type: "edit_accepted",
        title: "Merchant accepted your edit request",
        body: `Amount updated to Rs. ${Number(log.proposed_amount).toLocaleString()}`,
        reference_id: log.id,
        reference_type: "credit_log",
      });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to accept edit" }, { status: 500 });
  }
}
