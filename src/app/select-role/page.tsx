"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function SelectRolePage() {
  const router = useRouter();
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        const data: { userId: string | null; roles: string[] } = await res.json();
        if (!data.userId) {
          router.replace("/login");
          return;
        }
        setRoles(data.roles);
        // If user only has one role, skip selection
        if (data.roles.length === 1) {
          router.replace(data.roles[0] === "merchant" ? "/merchant/dashboard" : "/customer/dashboard");
          return;
        }
        if (data.roles.length === 0) {
          router.replace("/login");
          return;
        }
      } catch {
        router.replace("/login");
      }
      setLoading(false);
    })();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[var(--color-bg)]">
        <div className="w-8 h-8 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 py-12 bg-[var(--color-bg)]">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-[var(--color-primary)]">Choose your view</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-2">
          You have access to both merchant and customer accounts
        </p>
      </div>

      <div className="w-full max-w-sm space-y-4">
        <button
          onClick={() => router.push("/merchant/dashboard")}
          className="w-full p-6 rounded-xl border-2 border-[var(--color-primary)]/20 bg-white hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-all text-left"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <p className="text-base font-semibold text-gray-900">Merchant View</p>
              <p className="text-sm text-gray-500">Manage your shop, track sales, and view reports</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => router.push("/customer/dashboard")}
          className="w-full p-6 rounded-xl border-2 border-emerald-500/20 bg-white hover:border-emerald-500 hover:bg-emerald-50/50 transition-all text-left"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <div>
              <p className="text-base font-semibold text-gray-900">Customer View</p>
              <p className="text-sm text-gray-500">View your transaction history and manage account</p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
