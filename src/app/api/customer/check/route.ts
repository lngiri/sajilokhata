import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/phone";

export async function POST(request: Request) {
  try {
    let { phone } = await request.json();
    phone = normalizePhone(phone);

    if (!phone) {
      return NextResponse.json(
        { error: "phone is required" },
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: merchant } = await (adminClient.from("merchants") as any)
      .select("id")
      .eq("phone", phone)
      .maybeSingle();

    return NextResponse.json({ exists: !!merchant });
  } catch (err) {
    console.error("Customer check error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
