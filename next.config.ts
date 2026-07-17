import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bridge the HMAC secret to Edge Runtime (next.config env is available in ALL runtimes)
  // NEVER provide a fallback — getHmacKey() in session.ts will throw fatally if missing.
  env: {
    SESSION_HMAC_SECRET:
      process.env.SESSION_HMAC_SECRET
      || process.env.SUPABASE_SERVICE_ROLE_KEY,
  },

  // PWA support + cache control
  async headers() {
    return [
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
