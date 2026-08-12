import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { locales, defaultLocale, isValidLocale } from "./i18n";

const LOCALE_COOKIE = "qr_hisab_locale";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip API routes, static files, and Next.js internals
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/static/") ||
    pathname.includes(".") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.json" ||
    pathname === "/robots.txt"
  ) {
    return NextResponse.next();
  }

  // Check if locale is already in pathname (handle both /en and /en/)
  const pathnameHasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  );

  if (pathnameHasLocale) {
    return NextResponse.next();
  }

  // Get locale from cookie
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = cookieLocale && isValidLocale(cookieLocale) ? cookieLocale : defaultLocale;

  // Build target URL - avoid double redirect by checking if we're already at target
  const targetPath = `/${locale}${pathname === "/" ? "" : pathname}`;
  const targetUrl = new URL(targetPath, request.url);

  // Prevent redirect loop: if target equals current, don't redirect
  if (targetUrl.pathname === pathname && targetUrl.search === request.nextUrl.search) {
    return NextResponse.next();
  }

  // Redirect to localized path
  const response = NextResponse.redirect(targetUrl);

  // Set locale cookie (1 year expiry)
  response.cookies.set(LOCALE_COOKIE, locale, {
    maxAge: 365 * 24 * 60 * 60,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - manifest.json, robots.txt, etc.
     */
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.json|robots.txt|.*\\.).*)",
  ],
};