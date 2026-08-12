import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, getAdminSessionCookieOptions } from "@/lib/admin-session";

export async function GET() {
  // Use relative redirect so it works across both qrhisab.com and app.qrhisab.com
  const response = NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_SITE_URL || "https://app.qrhisab.com"));

  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    ...(await getAdminSessionCookieOptions(0)),
    expires: new Date(0),
    maxAge: 0,
  });

  return response;
}
