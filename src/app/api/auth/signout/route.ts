import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-session";

export async function GET() {
  // Redirect to /login with signedOut flag
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://app.qrhisab.com";
  const response = NextResponse.redirect(new URL("/login?signedOut=1", siteUrl));

  const pastDate = new Date(0);
  const cookieDomain = process.env.COOKIE_DOMAIN;

  // Known cookies to clear - explicit names ensure the browser removes them
  const cookiesToClear = [SESSION_COOKIE, ADMIN_SESSION_COOKIE, "auth_bypass", "auth_bypass_phone", "customer_session", "otp_code", "otp_phone"];

  for (const name of cookiesToClear) {
    // Clear without domain (matches cookies set on the exact hostname)
    response.cookies.set(name, "", {
      path: "/",
      expires: pastDate,
      maxAge: 0,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    // Clear with COOKIE_DOMAIN (matches cookies set with .qrhisab.com)
    if (cookieDomain) {
      response.cookies.set(name, "", {
        path: "/",
        expires: pastDate,
        maxAge: 0,
        domain: cookieDomain,
        sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      });
    }
  }

  return response;
}