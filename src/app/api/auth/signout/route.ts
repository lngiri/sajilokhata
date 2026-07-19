import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-session";

export async function GET() {
  // Redirect to /login with signedOut flag
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://app.qrhisab.com";
  const response = NextResponse.redirect(new URL("/login?signedOut=1", siteUrl));

  const pastDate = new Date(0);
  const cookieDomain = process.env.COOKIE_DOMAIN;
  console.log("[Signout] Clearing cookies. COOKIE_DOMAIN:", cookieDomain);

  // Known cookies to clear — explicit names ensure the browser removes them
  const cookiesToClear = [SESSION_COOKIE, ADMIN_SESSION_COOKIE, "auth_bypass", "auth_bypass_phone", "customer_session"];

  for (const name of cookiesToClear) {
    // Clear without domain (matches cookies set on the exact hostname)
    response.cookies.set(name, "", {
      path: "/",
      expires: pastDate,
      maxAge: 0,
    });
    // Clear with COOKIE_DOMAIN (matches cookies set with .qrhisab.com)
    if (cookieDomain) {
      response.cookies.set(name, "", {
        path: "/",
        expires: pastDate,
        maxAge: 0,
        domain: cookieDomain,
      });
    }
  }

  return response;
}
