import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_DOMAIN } from "@/lib/session";

export async function GET() {
  const response = NextResponse.redirect(
    new URL("/", process.env.NEXT_PUBLIC_SITE_URL!)
  );

  const pastDate = new Date(0);
  const clearOptions: Record<string, unknown> = {
    path: "/",
    expires: pastDate,
    maxAge: 0,
  };
  if (COOKIE_DOMAIN) clearOptions.domain = COOKIE_DOMAIN;

  // Clear EVERY cookie — wipes Supabase SSR tokens, custom session, bypass, etc.
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  for (const c of allCookies) {
    response.cookies.set(c.name, "", clearOptions);
  }

  return response;
}
