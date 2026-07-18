import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { normalizePhone } from "@/lib/phone";

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
    let { merchant_id, phone } = await request.json();
    phone = normalizePhone(phone);

    if (!merchant_id || !phone) {
      return NextResponse.json(
        { error: "merchant_id and phone are required" },
        { status: 400 }
      );
    }

    let client: any = getAdminClient();
    let isAdmin = true;

    if (!client) {
      // If admin client is unavailable, return a fallback signal
      // The caller will use localStorage-based auth instead
      return NextResponse.json({
        admin_unavailable: true,
        merchant_id,
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
          id: merchant_id,
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
      merchant_id,
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
