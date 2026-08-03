import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/verify/lookup
 * Resolve a credit_log by its verification_token using the service-role
 * client (RLS-safe). The anon browser client cannot read credit_logs under
 * the hardened RLS policies, so this runs server-side.
 */
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
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
      return NextResponse.json({ error: "Server config" }, { status: 500 });
    }

    const { data, error } = await (admin.from("credit_logs") as any)
      .select("id, amount, type, status, description, customer_id, merchant_id, initiated_by, proposed_amount, customers(name, phone, address), merchants(name)")
      .eq("verification_token", token)
      .maybeSingle();

    if (error) {
      console.error("[verify/lookup] error:", error);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }

    return NextResponse.json({ log: data || null });
  } catch (err) {
    console.error("[verify/lookup] error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
