import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminClient } from "@/lib/supabase/admin";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, business_name, business_type, address, photo_url } = body;

    const cookieStore = await cookies();
    const raw = cookieStore.get(SESSION_COOKIE)?.value;
    if (!raw) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const session = await verifySessionToken(raw);
    const sessionUserId = session?.userId ?? null;
    if (!sessionUserId) {
      return NextResponse.json({ error: "Session expired" }, { status: 401 });
    }

    // Use the session userId as authoritative — ignore any caller-supplied merchant_id
    const resolvedId = sessionUserId;
    console.log("[Profile] Using session merchant_id:", resolvedId);

    // Dynamic partial update — only include explicitly provided fields
    // Immutable fields like phone are never included
    const updatePayload: Record<string, unknown> = {};
    if (name !== undefined) updatePayload.name = name;
    if (business_name !== undefined) updatePayload.business_name = business_name;
    if (business_type !== undefined) updatePayload.business_type = business_type;
    if (address !== undefined) updatePayload.address = address;
    if (photo_url !== undefined) updatePayload.photo_url = photo_url;

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    const admin = getAdminClient();
    if (!admin) {
      console.error("[Profile] Admin client unavailable — service_role key not configured");
      return NextResponse.json(
        { error: "Server configuration error. Please contact support." },
        { status: 500 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin.from("merchants") as any)
      .update(updatePayload)
      .eq("id", resolvedId)
      .select();

    if (error) {
      console.error("[Profile] Update error:", error);
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
      // Missing column (e.g. photo_url not deployed yet) — skip that field
      if (error.code === "42703") {
        console.warn("[Profile] Missing column (42703) — retrying without photo_url");
        const retryPayload: Record<string, unknown> = {};
        if (name !== undefined) retryPayload.name = name;
        if (business_name !== undefined) retryPayload.business_name = business_name;
        if (business_type !== undefined) retryPayload.business_type = business_type;
        if (address !== undefined) retryPayload.address = address;
        const { data: retryData, error: retryErr } = await (admin.from("merchants") as any)
          .update(retryPayload)
          .eq("id", resolvedId)
          .select();
        if (retryErr) {
          console.error("[Profile] Retry update still failed:", retryErr);
          return NextResponse.json(
            { error: `Database error: ${retryErr.message}` },
            { status: 500 }
          );
        }
        console.log("[Profile] Profile saved successfully (after 42703 retry)");
        return NextResponse.json({ success: true, profile: Array.isArray(retryData) ? retryData[0] : retryData, merchant_id: resolvedId });
      }
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }

    console.log("[Profile] Profile saved successfully for merchant:", resolvedId);
    return NextResponse.json({ success: true, profile: Array.isArray(data) ? data[0] : data, merchant_id: resolvedId });
  } catch (err) {
    console.error("[Profile] Unexpected error:", err);
    return NextResponse.json(
      { error: "Could not save profile. Please try again." },
      { status: 500 }
    );
  }
}
