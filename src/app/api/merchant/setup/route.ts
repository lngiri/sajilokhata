import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { normalizePhone } from "@/lib/phone";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { allowed, retryAfter } = await checkRateLimit(`setup:${ip}`);
  if (!allowed) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${retryAfter}s.` },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  try {
    // Require authenticated merchant session
    const cookieStore = await cookies();
    const raw = cookieStore.get(SESSION_COOKIE)?.value;
    if (!raw) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }
    const session = await verifySessionToken(raw);
    const merchantId = session?.userId ?? null;
    if (!merchantId) {
      return NextResponse.json({ error: "Session expired" }, { status: 401 });
    }

    const body = await request.json();
    let phone = body?.phone;

    if (!phone || typeof phone !== "string") {
      return NextResponse.json(
        { error: "phone is required" },
        { status: 400 }
      );
    }

    phone = normalizePhone(phone);

    const client = getAdminClient();
    if (!client) {
      // If admin client is unavailable, return a fallback signal
      // The caller will use localStorage-based auth instead
      return NextResponse.json({
        admin_unavailable: true,
        merchant_id: merchantId,
        existed: false,
      });
    }

    // Pre-check: see if a merchant with this phone already exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingMerchant } = await (client.from("merchants") as any)
      .select("id")
      .eq("phone", phone)
      .maybeSingle();

    if (existingMerchant) {
      // Merchant already exists — return existing ID so login reuses it
      return NextResponse.json({
        success: true,
        merchant_id: existingMerchant.id,
        existed: true,
      });
    }

    // Create new merchant row
    const { error: upsertError } = await (client.from("merchants") as any)
      .upsert(
        {
          id: merchantId,
          phone,
          name: "Shop",
          business_type: "kirana",
        },
        { onConflict: "id" }
      );

    if (upsertError) {
      console.error("Failed to create merchants row:", upsertError);
      return NextResponse.json(
        { error: "Could not create profile. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      merchant_id: merchantId,
      existed: false,
    });
  } catch (err) {
    console.error("Merchant setup error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
