import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";

const VERIFICATION_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const { logId } = await req.json();
    if (!logId) {
      return NextResponse.json({ error: "logId is required" }, { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { allowed, retryAfter } = await checkRateLimit(`verify:${ip}`);
    if (!allowed) {
      return NextResponse.json(
        { error: `Too many requests. Try again in ${retryAfter}s.` },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const supabase = await createClient();
    const admin = getAdminClient();

    const { data: rawLog, error: fetchError } = await supabase
      .from("credit_logs")
      .select("id, amount, proposed_amount, status, customer_id, created_at")
      .eq("id", logId)
      .single();

    const log = rawLog as unknown as {
      id: string; amount: number; proposed_amount: number | null;
      status: string; customer_id: string; created_at: string;
    } | null;

    if (fetchError || !log) {
      return NextResponse.json({ error: "Credit log not found" }, { status: 404 });
    }

    if (log.status !== "edit_requested") {
      return NextResponse.json({ error: "No pending edit request for this transaction" }, { status: 400 });
    }

    const createdAt = new Date(log.created_at).getTime();
    if (Number.isFinite(createdAt) && Date.now() - createdAt > VERIFICATION_TOKEN_TTL_MS) {
      return NextResponse.json({ error: "Transaction verification window expired" }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from("credit_logs")
      .update({
        proposed_amount: null,
        status: "awaiting_confirmation",
        verification_token: null,
      })
      .eq("id", log.id);

    if (updateError) throw updateError;

    if (admin && log.customer_id) {
      await admin.from("notifications").insert({
        user_id: log.customer_id,
        user_type: "customer",
        type: "edit_rejected",
        title: "Merchant declined your edit request",
        body: `Edit request for Rs. ${Number(log.amount).toLocaleString()} was declined`,
        reference_id: log.id,
        reference_type: "credit_log",
      });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to reject edit" }, { status: 500 });
  }
}
