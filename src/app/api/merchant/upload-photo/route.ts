import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

/** Max image dimension (px) — images larger than this are resized client-side */
export const MAX_PHOTO_DIM = 512;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const merchantId = formData.get("merchantId") as string | null;

    if (!file || !merchantId) {
      return NextResponse.json({ error: "Missing file or merchantId" }, { status: 400 });
    }

    // Auth: verify session cookie
    const cookieStore = request.cookies;
    const raw = cookieStore.get(SESSION_COOKIE)?.value;
    if (!raw) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const userId = await verifySessionToken(raw);
    if (!userId || userId !== merchantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Server config" }, { status: 500 });
    }

    // Upload the file (already compressed on client side)
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop() || "webp";
    const fileName = `merchant-photos/${merchantId}/profile.${ext}`;

    const { error: uploadError } = await admin.storage
      .from("app_assets")
      .upload(fileName, buffer, {
        contentType: file.type || "image/webp",
        upsert: true,
        cacheControl: "31536000",
      });

    if (uploadError) {
      console.error("[Upload Photo] Storage error:", uploadError);
      return NextResponse.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 500 });
    }

    const { data: urlData } = admin.storage.from("app_assets").getPublicUrl(fileName);
    const publicUrl = urlData.publicUrl;

    // Update merchant profile — gracefully handle missing photo_url column
    const { error: updateErr } = await (admin.from("merchants") as any)
      .update({ photo_url: publicUrl })
      .eq("id", merchantId);

    if (updateErr) {
      if (updateErr.code === "42703") {
        console.warn("[Upload Photo] photo_url column missing — skipping DB update");
      } else {
        console.error("[Upload Photo] DB update error:", updateErr);
        return NextResponse.json({ error: "Failed to save photo URL" }, { status: 500 });
      }
    }

    return NextResponse.json({ url: publicUrl });
  } catch (err) {
    console.error("[Upload Photo]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
