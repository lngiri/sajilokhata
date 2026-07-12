import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

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

    const adminClient = getAdminClient();

    if (!adminClient) {
      return NextResponse.json(
        { error: "Admin client not available" },
        { status: 500 }
      );
    }

    // Cross-table check: if phone is being changed, ensure it's not a customer
    if (phone) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingCustomer } = await (adminClient.from("customers") as any)
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

      // Check if phone is already used by another merchant
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: phoneOwner } = await (adminClient.from("merchants") as any)
        .select("id")
        .eq("phone", phone)
        .maybeSingle();

      if (phoneOwner && phoneOwner.id !== merchant_id) {
        return NextResponse.json(
          {
            error: "यो नम्बर अर्को पसलमा दर्ता भइसकेको छ। कृपया अर्को नम्बर प्रयोग गर्नुहोस्।",
            code: "PHONE_TAKEN",
          },
          { status: 409 }
        );
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (adminClient.from("merchants") as any)
      .upsert(
        {
          id: merchant_id,
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
      return NextResponse.json(
        { error: "प्रोफाइल सेभ गर्न सकिएन। कृपया पुनः प्रयास गर्नुहोस्।" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, profile: data });
  } catch (err) {
    console.error("Merchant profile error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
