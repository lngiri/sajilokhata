import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const { phone } = await request.json();

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
