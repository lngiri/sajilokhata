import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { allowed, retryAfter } = checkRateLimit(`setup:${ip}`);
  if (!allowed) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${retryAfter}s.` },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  try {
    const { merchant_id, phone } = await request.json();

    if (!merchant_id || !phone) {
      return NextResponse.json(
        { error: "merchant_id and phone are required" },
        { status: 400 }
      );
    }

    const adminClient = getAdminClient();

    if (!adminClient) {
      return NextResponse.json(
        { error: "Admin client not available (SUPABASE_SERVICE_ROLE_KEY not set)" },
        { status: 500 }
      );
    }

    // Cross-table check: ensure phone is not already registered as a customer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingCustomer } = await (adminClient.from("customers") as any)
      .select("id")
      .eq("phone", phone)
      .maybeSingle();

    if (existingCustomer) {
      return NextResponse.json(
        {
          error: "यो नम्बर ग्राहक (Customer) को रूपमा दर्ता भइसकेको छ। कृपया अर्को नम्बर प्रयोग गर्नुहोस् वा खाता परिवर्तन गर्नुहोस्।",
          code: "PHONE_IS_CUSTOMER",
        },
        { status: 409 }
      );
    }

    // Pre-check: see if a merchant with this phone already exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingMerchant } = await (adminClient.from("merchants") as any)
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: upsertError } = await (adminClient.from("merchants") as any)
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
        { error: "प्रोफाइल बनाउन सकिएन। कृपया पुनः प्रयास गर्नुहोस्।" },
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
