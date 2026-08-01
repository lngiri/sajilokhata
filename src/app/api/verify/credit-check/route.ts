import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { allowed, retryAfter } = await checkRateLimit(`verify:${ip}`);
    if (!allowed) {
      return NextResponse.json(
        { error: `Too many requests. Try again in ${retryAfter}s.` },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
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

    // Only debit entries carry a credit limit
    if (log.type !== "debit" || !log.customer_id) {
      return NextResponse.json({ balance: null, creditLimit: null, remainingLimit: null, overLimit: false });
    }

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

    const balance = (approvedLogs as any[])?.reduce((sum: number, l: any) => {
      return sum + (l.type === "debit" ? l.amount : -l.amount);
    }, 0) || 0;

    const remainingLimit = creditLimit - balance;

    return NextResponse.json({
      balance,
      creditLimit,
      remainingLimit,
      overLimit: log.amount > remainingLimit,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to check credit limit" }, { status: 500 });
  }
}
