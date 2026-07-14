import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
