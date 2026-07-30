import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";

const VERIFICATION_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const { token, reason } = await req.json();
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
      .select("id, status, created_at")
      .eq("verification_token", token)
      .maybeSingle();

    const log = rawLog as unknown as { id: string; status: string; created_at: string } | null;

    if (fetchError || !log) {
      return NextResponse.json({ error: "Invalid verification token" }, { status: 400 });
    }

    if (log.status !== "awaiting_confirmation") {
      return NextResponse.json({ error: "Transaction already processed" }, { status: 400 });
    }

    const createdAt = new Date(log.created_at).getTime();
    if (Number.isFinite(createdAt) && Date.now() - createdAt > VERIFICATION_TOKEN_TTL_MS) {
      return NextResponse.json({ error: "Verification token expired" }, { status: 400 });
    }

    const { error: updateError } = await (admin.from("credit_logs") as any)
      .update({
        status: "disputed",
        disputed_reason: reason || null,
        verification_token: null,
      })
      .eq("id", log.id);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to dispute" }, { status: 500 });
  }
}
