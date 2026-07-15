import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-session";

export async function GET() {
  // Use relative redirect so it works in dev (localhost) and production
  const response = NextResponse.redirect(new URL("/admin/login", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"));

  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });

  return response;
}
