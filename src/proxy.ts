import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              // 1-year expiry for persistent sessions — users stay logged in
              // until they manually click "Sign Out"
              maxAge: 365 * 24 * 60 * 60,
              path: "/",
            })
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Check for custom session cookie (set after OTP verification)
  const rawSession = request.cookies.get(SESSION_COOKIE)?.value;
  const validUserId = rawSession ? await verifySessionToken(rawSession) : null;

  // Check for bypass auth cookie (used when service_role key is unavailable)
  const bypassCookie = request.cookies.get("auth_bypass");
  const isBypassed = bypassCookie?.value === "true";

  const isAuthenticated = !!user || !!validUserId || isBypassed;

  // On /login with a valid session → skip to dashboard
  if (request.nextUrl.pathname === "/login" && isAuthenticated) {
    const url = request.nextUrl.clone();
    url.pathname = "/merchant/dashboard";
    return NextResponse.redirect(url);
  }

  // === Merchant / Delivery Protection ===
  if (!isAuthenticated) {
    if (
      request.nextUrl.pathname.startsWith("/merchant") ||
      request.nextUrl.pathname.startsWith("/delivery")
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  // === Customer Protection (Cookie-based, localStorage fallback) ===
  // Customers use a localStorage-based session (set on /scan page).
  // A matching cookie is also set so middleware can prevent content flash
  // on server-rendered pages until the client-side useEffect redirect fires.
  const customerSessionCookie = request.cookies.get("customer_session");
  const isCustomerPath = request.nextUrl.pathname.startsWith("/customer/");

  if (isCustomerPath && !customerSessionCookie) {
    const url = request.nextUrl.clone();
    url.pathname = "/scan";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
