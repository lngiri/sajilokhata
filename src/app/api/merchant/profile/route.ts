import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/phone";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let { merchant_id, name, business_name, business_type, address, phone } = body;
    if (phone) phone = normalizePhone(phone);

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
            error: "This number is already registered to another shop. Please use a different number.",
            code: "PHONE_TAKEN",
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Could not save profile. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, profile: data, merchant_id: resolvedId });
  } catch (err) {
    console.error("Merchant profile error:", err);
    return NextResponse.json(
      { error: "Could not save profile. Please try again." },
      { status: 500 }
    );
  }
}
