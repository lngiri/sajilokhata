"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Admin Session Guard.
 *
 * Verifies the admin_session cookie on mount. If invalid/expired,
 * clears admin storage and redirects to /admin/login.
 */
export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const checked = useRef(false);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (checked.current) return;
    checked.current = true;

    // Skip on the login page itself
    if (window.location.pathname === "/admin/login") {
      setAuthorized(true);
      return;
    }

    fetch("/api/admin/session", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data.authorized) {
          setAuthorized(true);
        } else {
          localStorage.removeItem("admin_name");
          window.location.replace("/admin/login");
        }
      })
      .catch(() => {
        // Network error — allow the page to render (may show stale data)
        setAuthorized(true);
      });
  }, []);

  if (!authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
