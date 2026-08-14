import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { locales, defaultLocale, isValidLocale } from "./i18n";

const LOCALE_COOKIE = "qr_hisab_locale";

// Routes that HAVE a localized variant in src/app/[locale]/
// Only include routes that actually have a page.tsx under [locale]/
const LOCALIZED_ROUTES = [
  "/",
  "/customer/dashboard",
  "/customer/history",
  "/customer/settings",
];

function shouldLocalize(pathname: string): boolean {
  const clean = pathname.replace(/\/$/, "") || "/";

  // Exact match for known localized routes
  if (LOCALIZED_ROUTES.includes(clean)) return true;

  // Prefix match for nested routes
  return LOCALIZED_ROUTES.some((route) => {
    if (route === "/") return false;
    return clean === route || clean.startsWith(route + "/");
  });
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip API, static, and internal paths
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

  // Already has locale prefix
  const pathnameHasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  );
  if (pathnameHasLocale) return NextResponse.next();

  // ONLY redirect if this route has a [locale] variant
  if (!shouldLocalize(pathname)) {
    return NextResponse.next();
  }

  // Get locale from cookie or default
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = cookieLocale && isValidLocale(cookieLocale) ? cookieLocale : defaultLocale;

  const targetPath = `/${locale}${pathname === "/" ? "" : pathname}`;
  const targetUrl = new URL(targetPath, request.url);

  // Prevent redirect loops
  if (targetUrl.pathname === pathname && targetUrl.search === request.nextUrl.search) {
    return NextResponse.next();
  }

  const response = NextResponse.redirect(targetUrl);
  response.cookies.set(LOCALE_COOKIE, locale, {
    maxAge: 365 * 24 * 60 * 60,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.json|robots.txt|.*\\.).*)",
  ],
};