import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { SESSION_COOKIE } from "@/lib/session";
import { verifySessionToken } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const merchantId = formData.get("merchantId") as string | null;

    if (!file || !merchantId) {
      return NextResponse.json({ error: "Missing file or merchantId" }, { status: 400 });
    }

    const cookieStore = request.cookies;
    const raw = cookieStore.get(SESSION_COOKIE)?.value;
    if (!raw) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const userId = await verifySessionToken(raw);
    if (!userId || userId !== merchantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop() || "webp";
    const fileName = `merchant-photos/${merchantId}/profile.${ext}`;

    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Server config" }, { status: 500 });
    }

    const { error: uploadError } = await admin.storage
      .from("app_assets")
      .upload(fileName, buffer, { contentType: file.type, upsert: true });

    if (uploadError) {
      console.error("[Upload Photo] Storage error:", uploadError);
      return NextResponse.json({ error: "Storage upload failed" }, { status: 500 });
    }

    const { data: urlData } = admin.storage.from("app_assets").getPublicUrl(fileName);
    const publicUrl = urlData.publicUrl;

    await (admin.from("merchants") as any)
      .update({ photo_url: publicUrl })
      .eq("id", merchantId);

    return NextResponse.json({ url: publicUrl });
  } catch (err) {
    console.error("[Upload Photo]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
