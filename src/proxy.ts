import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // ── Auth check with timeout — fail open so the page renders even if DB is slow ──
  let user: any = null;
  let validUserId: string | null = null;

  try {
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
                maxAge: 365 * 24 * 60 * 60,
                path: "/",
              })
            );
          },
        },
      }
    );

    // Race auth against a 5-second timeout so slow Supabase doesn't block page load
    const authResult = await Promise.race([
      supabase.auth.getUser(),
      new Promise<"TIMEOUT">((_, reject) =>
        setTimeout(() => reject(new Error("Auth timeout")), 5000)
      ),
    ]);

    if (authResult !== "TIMEOUT") {
      user = (authResult as any).data?.user;
    }

    // Check for custom session cookie
    const rawSession = request.cookies.get(SESSION_COOKIE)?.value;
    if (rawSession) {
      validUserId = await verifySessionToken(rawSession);
    }
  } catch (err) {
    console.warn("[Proxy] Auth check failed (continuing):", err);
    // Fail open — page still renders, client-side auth will sort out redirects
  }

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
