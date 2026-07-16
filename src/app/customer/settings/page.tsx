"use client";

import { useState, useEffect } from "react";
import CustomerBottomNav from "@/components/CustomerBottomNav";
import OtherRolePrompt from "@/components/OtherRolePrompt";
import { signOut } from "@/lib/auth";
import CustomerPinGate from "@/components/CustomerPinGate";

const CUSTOMER_STORAGE_KEY = "sajilo_customer_session";

export default function CustomerSettings() {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CUSTOMER_STORAGE_KEY);
      if (raw) {
        const session = JSON.parse(raw);
        if (session.phone) {
          setCustomerPhone(session.phone);
          setCustomerName(session.name || "");
        }
      }
    } catch {
      // ignore
    } finally {
      setInitialized(true);
    }
  }, []);

  if (!initialized) {
    return (
      <div className="min-h-dvh bg-[var(--color-bg)] flex items-center justify-center">
        <div role="status" className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleSignOut = () => {
    setSigningOut(true);
    localStorage.removeItem(CUSTOMER_STORAGE_KEY);
    localStorage.removeItem("sajilo_customer_session");
    document.cookie = "customer_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; max-age=0";
    window.location.replace("/login");
  };

  const maskPhone = (phone: string): string => {
    if (phone.length < 8) return phone;
    return phone.slice(0, 4) + "****" + phone.slice(-2);
  };

  return (
    <CustomerPinGate phone={customerPhone} onUnlocked={() => {}} onSignOut={() => {}}>
    <div className="min-h-dvh bg-[var(--color-bg)] pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center gap-2.5 px-4 py-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm flex-shrink-0">
            <span className="text-sm font-bold text-white tracking-tight">QR</span>
          </div>
          <div>
            <h1 className="text-base font-bold text-[var(--color-text)]">Settings</h1>
            <p className="text-[10px] text-emerald-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              qrhisab.com
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-50 divide-y divide-gray-50">
          <div className="p-4">
            <label className="block text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-semibold mb-1">
              Display Name
            </label>
            <p className="text-sm font-medium text-[var(--color-text)]">
              {customerName || "Unnamed Customer"}
            </p>
          </div>
          <div className="p-4">
            <label className="block text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-semibold mb-1">
              Registered Phone
            </label>
            <p className="text-sm font-mono text-[var(--color-text)]">
              {customerPhone ? maskPhone(customerPhone) : "—"}
            </p>
          </div>
        </div>

        {/* Sign Out Button */}
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full py-3.5 bg-red-50 text-red-600 rounded-xl font-semibold text-sm active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2 border border-red-200"
        >
          {signingOut ? (
            <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
              Sign Out
            </>
          )}
        </button>
      </div>

      <CustomerBottomNav />
      <OtherRolePrompt currentRole="customer" />
    </div>
    </CustomerPinGate>
  );
}
