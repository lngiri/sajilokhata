import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const CUSTOMER_COOKIE_NAME = "customer_session";

const publicPaths = ["/", "/login", "/api/auth/bypass", "/api/merchant/setup"];

function isPublicPath(pathname: string): boolean {
  return publicPaths.some((p) => pathname === p || pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Allow static assets and API routes (except our guarded ones)
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/api/") ||
    pathname === "/"
  ) {
    return NextResponse.next();
  }

  // --- Merchant route guard ---
  if (pathname.startsWith("/merchant/")) {
    let response = NextResponse.next();

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
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      const bypassCookie = request.cookies.get("auth_bypass");
      if (bypassCookie?.value === "true") {
        return response;
      }

      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    return response;
  }

  // --- Customer route guard ---
  if (pathname.startsWith("/customer/")) {
    const customerCookie = request.cookies.get(CUSTOMER_COOKIE_NAME);

    if (!customerCookie?.value) {
      const scanUrl = new URL("/scan", request.url);
      scanUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(scanUrl);
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
