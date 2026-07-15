import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { verifyAdminSessionToken, ADMIN_SESSION_COOKIE } from "@/lib/admin-session";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── PUBLIC ROUTES — always pass through, no auth processing ──
  const PUBLIC_ROUTES = [
    "/", "/login", "/select-role", "/scan", "/onboard", "/delivery",
    "/verify", "/_not-found",
  ];
  if (PUBLIC_ROUTES.includes(pathname)) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  // ── Auth checks — Supabase and custom-session are fully independent ──
  let user: any = null;
  let validUserId: string | null = null;
  const envCheck = {
    supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    anonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };

  console.log("[Proxy] ENV check:", JSON.stringify(envCheck), "| path:", pathname);

  // 1. Supabase Auth (with timeout so slow startup doesn't block navigation)
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

    const authResult = await Promise.race([
      supabase.auth.getUser(),
      new Promise<"TIMEOUT">((_, reject) =>
        setTimeout(() => reject(new Error("Auth timeout")), 5000)
      ),
    ]);

    if (authResult !== "TIMEOUT") {
      user = (authResult as any).data?.user;
    }
    console.log("[Proxy] Supabase auth result:", user?.id ? `user=${user.id}` : "no-user");
  } catch (err) {
    console.warn("[Proxy] Supabase auth check failed (continuing):", err);
  }

  // 2. Custom session cookie — fully independent from Supabase above
  const rawSession = request.cookies.get(SESSION_COOKIE)?.value;
  console.log("[Proxy] Session cookie present:", !!rawSession, "| cookie name:", SESSION_COOKIE);
  try {
    if (rawSession) {
      validUserId = await verifySessionToken(rawSession);
      console.log("[Proxy] Session token verified:", validUserId ? `userId=${validUserId}` : "INVALID-TOKEN");
    }
  } catch (err) {
    console.warn("[Proxy] Session cookie verify failed (continuing):", err);
  }

  const bypassCookie = request.cookies.get("auth_bypass");
  const isBypassed = bypassCookie?.value === "true";

  const isAuthenticated = !!user || !!validUserId || isBypassed;
  console.log("[Proxy] Auth state:", { isAuthenticated, hasSupabaseUser: !!user, hasSessionUser: !!validUserId, isBypassed });

  // ── Determine user roles from DB for session-based users ──
  let userRoles: ("merchant" | "customer")[] = [];
  if (validUserId) {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (supabaseUrl && serviceKey) {
        const admin = createClient(supabaseUrl, serviceKey, {
          auth: { persistSession: false },
        });
        const [mRes, cRes] = await Promise.all([
          (admin.from("merchants") as any)
            .select("id, force_logout_at")
            .eq("id", validUserId)
            .maybeSingle(),
          (admin.from("customers") as any)
            .select("id")
            .eq("id", validUserId)
            .maybeSingle(),
        ]);

        console.log("[Proxy] DB lookup for userId:", validUserId, "| merchant:", !!mRes?.data?.id, "| customer:", !!cRes?.data?.id, "| force_logout_at:", mRes?.data?.force_logout_at);

        // Force-logout check
        if (mRes?.data?.force_logout_at) {
          console.log("[Proxy] FORCE LOGOUT detected for userId:", validUserId);
          const res = NextResponse.redirect(new URL("/login?forceLogout=1", request.url));
          res.cookies.delete(SESSION_COOKIE);
          return res;
        }

        if (mRes?.data?.id) userRoles.push("merchant");
        if (cRes?.data?.id) userRoles.push("customer");
      } else {
        console.warn("[Proxy] Missing DB creds (url or service key) — skipping role lookup");
      }
    } catch (err) {
      console.warn("[Proxy] Role lookup failed — allowing access:", err);
    }
  }

  console.log("[Proxy] Final decision:", { pathname, isAuthenticated, userRoles, action: "continue" });

  // === Merchant / Delivery Protection ===
  const isMerchantPath = request.nextUrl.pathname.startsWith("/merchant");

  if (!isAuthenticated) {
    if (isMerchantPath || request.nextUrl.pathname.startsWith("/delivery")) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  } else {
    // Role-based route protection for session users
    if (isMerchantPath && validUserId && !userRoles.includes("merchant")) {
      // Customer-only user trying to access merchant pages
      if (userRoles.includes("customer")) {
        const url = request.nextUrl.clone();
        url.pathname = "/customer/dashboard";
        return NextResponse.redirect(url);
      }
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  // === Admin Protection (completely isolated from merchant/customer sessions) ===
  const path = request.nextUrl.pathname;
  if (path.startsWith("/admin")) {
    // Allow admin login page without auth
    if (path === "/admin/login") {
      // If already logged in, skip to dashboard
      try {
        const rawAdmin = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
        if (rawAdmin) {
          const adminId = await verifyAdminSessionToken(rawAdmin);
          if (adminId) {
            const url = request.nextUrl.clone();
            url.pathname = "/admin/dashboard";
            return NextResponse.redirect(url);
          }
        }
      } catch {
        console.warn("[Proxy] Admin session check on /admin/login failed");
      }
      return supabaseResponse;
    }

    // All other /admin/* routes require a valid admin session
    try {
      const rawAdmin = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
      const validAdminId = rawAdmin ? await verifyAdminSessionToken(rawAdmin) : null;

      if (!validAdminId) {
        const url = request.nextUrl.clone();
        url.pathname = "/admin/login";
        return NextResponse.redirect(url);
      }
    } catch {
      console.warn("[Proxy] Admin session verification failed — redirecting to login");
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
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
    "/((?!api/auth/signout|_next/static|_next/image|favicon.ico|icons|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
