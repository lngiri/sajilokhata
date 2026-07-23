"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const ROLE_KEY = "active_role";

type Role = "merchant" | "customer";

interface RoleSwitcherProps {
  compact?: boolean;
}

/**
 * Smart Role Switcher — appears in the dashboard header when the user
 * has both a Merchant and a Customer account.
 *
 * - Detects dual-role via API instead of localStorage keys
 * - Persists active role in localStorage
 * - On switch: hard-navigates (full page reload)
 */
export default function RoleSwitcher({ compact }: RoleSwitcherProps) {
  const [hasDualRole, setHasDualRole] = useState(false);
  const [currentRole, setCurrentRole] = useState<Role>("merchant");
  const [switching, setSwitching] = useState(false);
  const checkedRef = useRef(false);

  const checkRoles = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session");
      const data = await res.json();
      const roles: string[] = data?.roles ?? [];
      setHasDualRole(roles.includes("merchant") && roles.includes("customer"));

      const saved = localStorage.getItem(ROLE_KEY) as Role | null;
      if (roles.includes("merchant") && roles.includes("customer")) {
        setCurrentRole(saved === "customer" || saved === "merchant" ? saved : "merchant");
      } else if (roles.includes("merchant")) {
        setCurrentRole("merchant");
      } else {
        setCurrentRole("customer");
      }
    } catch {
      setHasDualRole(false);
    }
  }, []);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;
    checkRoles();
  }, [checkRoles]);

  const handleSwitch = () => {
    if (switching) return;
    setSwitching(true);

    const next: Role = currentRole === "merchant" ? "customer" : "merchant";
    localStorage.setItem(ROLE_KEY, next);

    window.location.replace(
      next === "merchant" ? "/merchant/dashboard" : "/customer/dashboard"
    );
  };

  if (!hasDualRole) return null;

  const isMerchant = currentRole === "merchant";

  if (compact) {
    return (
      <button
        onClick={handleSwitch}
        disabled={switching}
        className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 active:scale-90 transition-transform flex-shrink-0 disabled:opacity-50"
        title={`Switch to ${isMerchant ? "Customer" : "Merchant"} view`}
      >
        {switching ? (
          <div className="w-2.5 h-2.5 border border-slate-400 border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg className="w-3 h-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
          </svg>
        )}
      </button>
    );
  }

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
