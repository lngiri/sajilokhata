import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { merchant_id, name, business_name, business_type, address, phone } = body;

    if (!merchant_id) {
      return NextResponse.json(
        { error: "merchant_id is required" },
        { status: 400 }
      );
    }

    // Try admin client first (bypasses RLS), fall back to server client (user auth)
    let client: any = getAdminClient();

    if (!client) {
      client = await createClient();
    }

    // Cross-table check: if phone is being changed, ensure it's not a customer
    if (phone) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingCustomer } = await (client.from("customers") as any)
        .select("id")
        .eq("phone", phone)
        .maybeSingle();

      if (existingCustomer) {
        return NextResponse.json(
          {
            error: "यो नम्बर ग्राहक (Customer) को रूपमा दर्ता भइसकेको छ। कृपया अर्को नम्बर प्रयोग गर्नुहोस्।",
            code: "PHONE_IS_CUSTOMER",
          },
          { status: 409 }
        );
      }
    }

    // If phone is provided, look up existing merchant by phone to resolve ID.
    // This handles stale localStorage merchant_id and duplicate records.
    let resolvedId = merchant_id;
    if (phone) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingByPhone } = await (client.from("merchants") as any)
        .select("id")
        .eq("phone", phone)
        .maybeSingle();

      if (existingByPhone && existingByPhone.id !== merchant_id) {
        resolvedId = existingByPhone.id;
      }
    }

    // Upsert merchant profile — DB UNIQUE constraint on phone prevents duplicates
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (client.from("merchants") as any)
      .upsert(
        {
          id: resolvedId,
          ...(name !== undefined && { name }),
          ...(business_name !== undefined && { business_name }),
          ...(business_type !== undefined && { business_type }),
          ...(address !== undefined && { address }),
          ...(phone !== undefined && { phone }),
        },
        { onConflict: "id" }
      )
      .select()
      .single();

    if (error) {
      console.error("Failed to update merchant profile:", error);
      // Handle unique violation on phone (PostgreSQL error code 23505)
      if (error.code === "23505") {
        return NextResponse.json(
          {
            error: "यो नम्बर अर्को पसलमा दर्ता भइसकेको छ। कृपया अर्को नम्बर प्रयोग गर्नुहोस्।",
            code: "PHONE_TAKEN",
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "प्रोफाइल सेभ गर्न सकिएन। कृपया पुनः प्रयास गर्नुहोस्।" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, profile: data, merchant_id: resolvedId });
  } catch (err) {
    console.error("Merchant profile error:", err);
    return NextResponse.json(
      { error: "प्रोफाइल सेभ गर्न सकिएन। कृपया पुनः प्रयास गर्नुहोस्।" },
      { status: 500 }
    );
  }
}
