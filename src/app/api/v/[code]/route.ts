import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  if (!code || code.length > 10) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const { data } = await admin
    .from("short_links")
    .select("destination_url")
    .eq("code", code)
    .maybeSingle();

  const link = data as { destination_url: string } | null;
  if (!link) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://qrhisab.com";
  const destination = new URL(link.destination_url, baseUrl);

  return NextResponse.redirect(destination, { status: 308 });
}
