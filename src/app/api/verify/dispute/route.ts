import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const { token, reason } = await req.json();
    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const { data: rawLog, error: fetchError } = await (admin.from("credit_logs") as any)
      .select("id, status")
      .eq("verification_token", token)
      .maybeSingle();

    const log = rawLog as unknown as { id: string; status: string } | null;

    if (fetchError || !log) {
      return NextResponse.json({ error: "Invalid verification token" }, { status: 400 });
    }

    if (log.status !== "unverified") {
      return NextResponse.json({ error: "Transaction already processed" }, { status: 400 });
    }

    const { error: updateError } = await (admin.from("credit_logs") as any)
      .update({
        status: "disputed",
        disputed_reason: reason || null,
      })
      .eq("id", log.id);

    if (updateError) throw updateError;

    await (admin.from("audit_logs") as any).insert({
      credit_log_id: log.id,
      action: "disputed",
      actor_type: "customer",
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to dispute" }, { status: 500 });
  }
}
