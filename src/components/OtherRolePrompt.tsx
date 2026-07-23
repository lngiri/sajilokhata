"use client";

import { useState, useEffect } from "react";

type Role = "merchant" | "customer";

interface Props {
  currentRole: Role;
}

/**
 * Prompts the user to register as the other role (customer ↔ merchant)
 * if they only have one role. Shows once per session.
 */
export default function OtherRolePrompt({ currentRole }: Props) {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (dismissed) return;
    const dismissedKey = `other_role_prompt_dismissed_${currentRole}`;
    if (sessionStorage.getItem(dismissedKey)) return;

    (async () => {
      try {
        const res = await fetch("/api/auth/session");
        const data = await res.json();
        const roles: string[] = data?.roles ?? [];

        const hasMerchant = roles.includes("merchant");
        const hasCustomer = roles.includes("customer");

        // Only show if user has exactly one role (the current one)
        if (hasMerchant && !hasCustomer && currentRole === "merchant") {
          setShow(true);
        } else if (!hasMerchant && hasCustomer && currentRole === "customer") {
          setShow(true);
        }
      } catch {
        // API unavailable
      }
    })();
  }, [currentRole, dismissed]);

  const handleDismiss = () => {
    setShow(false);
    setDismissed(true);
    sessionStorage.setItem(`other_role_prompt_dismissed_${currentRole}`, "1");
  };

  const handleRegister = () => {
    sessionStorage.setItem(`other_role_prompt_dismissed_${currentRole}`, "1");
    setDismissed(true);
    window.location.replace(`/login?addRole=${otherRole}`);
  };

  if (!show) return null;

  const otherRole = currentRole === "merchant" ? "customer" : "merchant";
  const otherLabel = currentRole === "merchant" ? "Customer" : "Shop Owner";

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[200] bg-black/30 backdrop-blur-sm"
        onClick={handleDismiss}
      />

      {/* Modal */}
      <div className="fixed bottom-0 left-0 right-0 z-[201] animate-slide-up">
        <div className="bg-white dark:bg-[var(--color-surface)] rounded-t-2xl shadow-xl px-5 pt-6 pb-8 mx-2 mb-2">
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />

          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-[var(--color-text)] text-sm">
                Also use as {otherLabel}?
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                You are currently registered only as a {currentRole}. Register as {otherLabel} too to switch between both views.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleDismiss}
              className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-medium active:scale-[0.98] transition-transform"
            >
              Not now
            </button>
            <button
              onClick={handleRegister}
              className="flex-1 py-2.5 bg-[var(--color-primary)] text-white rounded-xl text-sm font-semibold active:scale-[0.98] transition-transform"
            >
              Register as {otherLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
