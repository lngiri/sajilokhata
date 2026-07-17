import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const { data: rawLog, error: fetchError } = await (admin.from("credit_logs") as any)
      .select("id, amount, type, status, merchant_id, customer_id")
      .eq("verification_token", token)
      .maybeSingle();

    const log = rawLog as unknown as {
      id: string; amount: number; type: string; status: string;
      merchant_id: string; customer_id: string;
    } | null;

    if (fetchError || !log) {
      return NextResponse.json({ error: "Invalid verification token" }, { status: 400 });
    }

    if (log.status !== "unverified") {
      return NextResponse.json({ error: "Transaction already processed" }, { status: 400 });
    }

    if (log.type === "debit" && log.customer_id) {
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

      if (log.amount > remainingLimit) {
        return NextResponse.json({
          error: `Credit limit exceeded. Available: Rs. ${remainingLimit.toLocaleString()}, Requested: Rs. ${log.amount.toLocaleString()}`,
          code: "CREDIT_LIMIT_EXCEEDED",
        }, { status: 400 });
      }
    }

    const { error: updateError } = await (admin.from("credit_logs") as any)
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
      })
      .eq("id", log.id);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to approve" }, { status: 500 });
  }
}
