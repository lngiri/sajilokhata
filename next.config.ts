import type { NextConfig } from "next";
import { createLocalizedPathnamesNavigation } from "next-intl/navigation";
import { locales } from "./i18n";

const { LocalizedPathnamesNavigation } = createLocalizedPathnamesNavigation({
  locales,
  pathnames: {
    "/": "/",
    "/scan": "/scan",
    "/login": "/login",
    "/onboard": "/onboard",
    "/select-role": "/select-role",
    "/verify": "/verify",
    "/merchant/dashboard": "/merchant/dashboard",
    "/merchant/scan": "/merchant/scan",
    "/merchant/logs": "/merchant/logs",
    "/merchant/customers": "/merchant/customers",
    "/merchant/customers/[id]": "/merchant/customers/[id]",
    "/merchant/qr": "/merchant/qr",
    "/merchant/settings": "/merchant/settings",
    "/merchant/billing": "/merchant/billing",
    "/merchant/cash-sales": "/merchant/cash-sales",
    "/merchant/reports": "/merchant/reports",
    "/merchant/import": "/merchant/import",
    "/merchant/products": "/merchant/products",
    "/customer/dashboard": "/customer/dashboard",
    "/customer/history": "/customer/history",
    "/customer/scan": "/customer/scan",
    "/customer/settings": "/customer/settings",
    "/admin/login": "/admin/login",
    "/admin/dashboard": "/admin/dashboard",
  },
});

const nextConfig: NextConfig = {
  // Bridge the HMAC secret to Edge Runtime (next.config env is available in ALL runtimes)
  // NEVER provide a fallback — getHmacKey() in session.ts will throw fatally if missing.
  env: {
    SESSION_HMAC_SECRET:
      process.env.SESSION_HMAC_SECRET
      || process.env.SUPABASE_SERVICE_ROLE_KEY,
  },

  // PWA support + cache control + CORS for cross-domain RSC
  async headers() {
    return [
      // CORS headers for cross-domain navigation between qrhisab.com ↔ app.qrhisab.com
      // Next.js sends RSC headers during client-side navigation; both domains must allow them.
      {
        source: "/(.*)",
        has: [{ type: "header", key: "origin", value: "https://qrhisab.com" }],
        headers: [
          { key: "Access-Control-Allow-Origin", value: "https://qrhisab.com" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "RSC, Next-Router-State-Tree, Next-Url, Next-Router-Prefetch, Next-Router-Segment-Prefetch, Next-Action, Accept, Content-Type" },
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Max-Age", value: "86400" },
        ],
      },
      {
        source: "/(.*)",
        has: [{ type: "header", key: "origin", value: "https://app.qrhisab.com" }],
        headers: [
          { key: "Access-Control-Allow-Origin", value: "https://app.qrhisab.com" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "RSC, Next-Router-State-Tree, Next-Url, Next-Router-Prefetch, Next-Router-Segment-Prefetch, Next-Action, Accept, Content-Type" },
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Max-Age", value: "86400" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
      // Prevent aggressive caching of HTML pages — new deployments must be immediate
      {
        source: "/((?!_next/static|_next/image|favicon.ico|icons|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
