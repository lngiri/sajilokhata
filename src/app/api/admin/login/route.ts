import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getAdminClient } from "@/lib/supabase/admin";
import { createAdminSessionToken, ADMIN_SESSION_COOKIE, ADMIN_SESSION_COOKIE_OPTIONS } from "@/lib/admin-session";
import type { Database } from "@/lib/types/database";

type AdminRow = Database["public"]["Tables"]["admins"]["Row"];

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }
    if (!password) {
      return NextResponse.json({ error: "Password required" }, { status: 400 });
    }

    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Server config error" }, { status: 500 });
    }

    const { data } = await admin.from("admins")
      .select("id, name, email, password_hash")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    const row = data as AdminRow | null;

    if (!row) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (!row.password_hash) {
      return NextResponse.json({ error: "Account not fully configured" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, row.password_hash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const { token, maxAge } = await createAdminSessionToken(row.id);
    const response = NextResponse.json({ success: true, name: row.name });

    response.cookies.set(ADMIN_SESSION_COOKIE, token, { ...ADMIN_SESSION_COOKIE_OPTIONS, maxAge });

    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
