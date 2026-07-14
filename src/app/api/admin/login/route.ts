import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { createAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/admin-session";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Server config error" }, { status: 500 });
    }

    const { data } = await (admin.from("admins") as any)
      .select("id, name")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (!data) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { token, maxAge } = await createAdminSessionToken(data.id);
    const response = NextResponse.json({ success: true, name: data.name });

    response.cookies.set(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge,
      path: "/",
    });

    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
