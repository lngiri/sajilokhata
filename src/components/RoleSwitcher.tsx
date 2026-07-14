"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

const ROLE_KEY = "active_role";
const CUSTOMER_SESSION_KEY = "sajilo_customer_session";

type Role = "merchant" | "customer";

/**
 * Smart Role Switcher — appears in the dashboard header when the user
 * has both a Merchant and a Customer account.
 *
 * - Persists active role in localStorage
 * - On switch: clears stale data context and does a HARD navigation
 *   (full page reload) so no React state leaks between roles.
 */
export default function RoleSwitcher() {
  const pathname = usePathname();
  const [hasDualRole, setHasDualRole] = useState(false);
  const [currentRole, setCurrentRole] = useState<Role>("merchant");
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    const hasMerchant = !!localStorage.getItem("merchant_id");
    const hasCustomer = !!localStorage.getItem(CUSTOMER_SESSION_KEY);
    setHasDualRole(hasMerchant && hasCustomer);

    const saved = localStorage.getItem(ROLE_KEY) as Role | null;
    if (saved === "merchant" || saved === "customer") {
      setCurrentRole(saved);
    }
  }, [pathname]);

  const handleSwitch = () => {
    if (switching) return;
    setSwitching(true);

    const next: Role = currentRole === "merchant" ? "customer" : "merchant";
    localStorage.setItem(ROLE_KEY, next);

    // Hard-navigate to force a full data-context reset
    window.location.replace(
      next === "merchant" ? "/merchant/dashboard" : "/customer/dashboard"
    );
  };

  if (!hasDualRole) return null;

  const isMerchant = currentRole === "merchant";
  const isCustomer = currentRole === "customer";

  return (
    <button
      onClick={handleSwitch}
      disabled={switching}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 active:scale-95 transition-transform text-[11px] font-medium text-slate-700 whitespace-nowrap disabled:opacity-50"
      title={`Switch to ${isMerchant ? "Customer" : "Merchant"} view`}
    >
      {switching ? (
        <div className="w-2 h-2 border border-slate-500 border-t-transparent rounded-full animate-spin" />
      ) : (
        <span className={`w-2 h-2 rounded-full ${isMerchant ? "bg-blue-500" : "bg-green-500"}`} />
      )}
      <span>{isMerchant ? "Merchant" : "Customer"}</span>
      <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
      <span className="text-[10px] text-slate-400">Switch</span>
    </button>
  );
}
