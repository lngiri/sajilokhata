import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const merchantId = formData.get("merchantId") as string | null;
    const methodType = formData.get("methodType") as string | null;

    if (!file || !merchantId || !methodType) {
      return NextResponse.json({ error: "Missing file, merchantId, or methodType" }, { status: 400 });
    }

    const validTypes = ["fonepay", "esewa", "khalti", "nepalpay", "bank_deposit", "cash"];
    if (!validTypes.includes(methodType)) {
      return NextResponse.json({ error: "Invalid method type" }, { status: 400 });
    }

    const cookieStore = request.cookies;
    const raw = cookieStore.get(SESSION_COOKIE)?.value;
    if (!raw) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const session = await verifySessionToken(raw);
    const userId = session?.userId ?? null;
    if (!userId || userId !== merchantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Server config" }, { status: 500 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop() || "webp";
    const fileName = `payment-qr/${merchantId}/${methodType}.${ext}`;

    const { error: uploadError } = await admin.storage
      .from("app_assets")
      .upload(fileName, buffer, {
        contentType: file.type || "image/webp",
        upsert: true,
        cacheControl: "31536000",
      });

    if (uploadError) {
      console.error("[Upload Payment QR] Storage error:", uploadError);
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }

    const { data: urlData } = admin.storage.from("app_assets").getPublicUrl(fileName);
    const publicUrl = urlData.publicUrl;

    return NextResponse.json({ url: publicUrl });
  } catch (err) {
    console.error("[Upload Payment QR]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
