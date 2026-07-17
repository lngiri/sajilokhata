"use client";

import { useState, useEffect } from "react";
import CustomerBottomNav from "@/components/CustomerBottomNav";
import OtherRolePrompt from "@/components/OtherRolePrompt";
import { useToast } from "@/components/Toast";
import { signOut } from "@/lib/auth";
import { updateCustomerProfile } from "@/app/actions/customer";
import CustomerPinGate from "@/components/CustomerPinGate";

const CUSTOMER_STORAGE_KEY = "sajilo_customer_session";

export default function CustomerSettings() {
  const { addToast } = useToast();
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CUSTOMER_STORAGE_KEY);
      if (raw) {
        const session = JSON.parse(raw);
        if (session.phone) {
          setCustomerPhone(session.phone);
          setCustomerName(session.name || "");
          setEditName(session.name || "");
        }
      }
    } catch {
      // ignore
    } finally {
      setInitialized(true);
    }
  }, []);

  const handleSave = async () => {
    const trimmed = editName.trim();
    if (!trimmed) {
      addToast("Name cannot be empty.", "error");
      return;
    }
    if (!customerPhone) {
      addToast("Phone number not found. Please sign in again.", "error");
      return;
    }
    setSaving(true);
    try {
      const result = await updateCustomerProfile(customerPhone, { name: trimmed });
      if (result.success) {
        setCustomerName(trimmed);
        localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify({ name: trimmed, phone: customerPhone }));
        addToast("Profile updated successfully!", "success");
      } else {
        addToast(result.error || "Failed to update profile.", "error");
      }
    } catch {
      addToast("Something went wrong. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

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
    localStorage.removeItem("customer_pin_unlocked");
    window.location.replace("/");
  };

  const maskPhone = (phone: string): string => {
    if (phone.length < 8) return phone;
    return phone.slice(0, 4) + "****" + phone.slice(-2);
  };

  const hasChanges = editName.trim() !== customerName;

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
            <label className="block text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-semibold mb-1.5">
              Display Name
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-2.5 bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all text-sm font-medium text-[var(--color-text)]"
            />
            {hasChanges && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="mt-3 w-full py-2.5 bg-[var(--color-primary)] text-white rounded-xl font-semibold text-sm active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    Save Changes
                  </>
                )}
              </button>
            )}
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
