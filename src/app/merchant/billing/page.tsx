"use client";

import { useState, useEffect, useRef } from "react";
import BottomNav from "@/components/BottomNav";
import { useToast } from "@/components/Toast";
import { getCurrentMerchantId } from "@/lib/auth";
import {
  initiateEsewaPayment,
  getMerchantSmsBalance,
  getMerchantRechargeHistory,
} from "@/app/actions/sms-billing";
import { SMS_PACKAGES, type SmsPackageType } from "@/lib/types/sms-billing";

type PackageKey = SmsPackageType;

const PACKAGE_META: Record<PackageKey, { color: string; popular?: boolean }> = {
  small: { color: "from-blue-500 to-blue-600" },
  medium: { color: "from-[var(--color-primary)] to-[var(--color-primary-dark)]", popular: true },
  large: { color: "from-purple-500 to-purple-600" },
};

export default function BillingPage() {
  const { addToast } = useToast();
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [smsBalance, setSmsBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<PackageKey | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const init = async () => {
      const mid = await getCurrentMerchantId();
      if (!mid) return;
      setMerchantId(mid);
      const [balance, history] = await Promise.all([
        getMerchantSmsBalance(mid),
        getMerchantRechargeHistory(mid),
      ]);
      setSmsBalance(balance);
      if (history.success) setLogs(history.logs || []);
      setLoading(false);
    };
    init();
  }, []);

  const handleBuy = async (pkg: PackageKey) => {
    if (!merchantId) return;
    setBuying(pkg);
    try {
      const result = await initiateEsewaPayment(merchantId, pkg);
      if (!result.success || !result.formParams || !result.esewaUrl) {
        addToast(result.error || "Failed to initiate payment", "error");
        setBuying(null);
        return;
      }
      // Build and submit hidden form
      const form = formRef.current;
      if (!form) { setBuying(null); return; }
      form.action = result.esewaUrl;
      form.method = "POST";
      // Remove existing hidden inputs
      while (form.firstChild) form.removeChild(form.firstChild);
      for (const [key, value] of Object.entries(result.formParams)) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = value;
        form.appendChild(input);
      }
      form.submit();
    } catch {
      addToast("Something went wrong", "error");
      setBuying(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center pb-24">
        <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] pb-24">
      {/* Hidden form for eSewa redirect */}
      <form ref={formRef} style={{ display: "none" }} />

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text)]">SMS Credits</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Recharge to send payment reminders</p>
        </div>

        {/* Balance Badge */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-50 p-6 text-center">
          <p className="text-sm text-[var(--color-text-muted)] mb-1">Current Balance</p>
          <p className="text-4xl font-bold text-[var(--color-text)]">{smsBalance}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">SMS credits remaining</p>
        </div>

        {/* Low Balance Warning */}
        {smsBalance <= 5 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <p className="text-sm text-amber-800">
              Your SMS balance is running low.{" "}
              <span className="font-medium">Recharge below to continue sending payment reminders.</span>
            </p>
          </div>
        )}

        {/* Plan Cards */}
        <section>
          <h2 className="font-semibold text-[var(--color-text)] mb-3">Recharge Packages</h2>
          <div className="grid grid-cols-3 gap-3">
            {(Object.entries(SMS_PACKAGES) as [PackageKey, typeof SMS_PACKAGES[PackageKey]][]).map(([key, pkg]) => {
              const meta = PACKAGE_META[key];
              return (
                <div
                  key={key}
                  className={`relative bg-white rounded-2xl shadow-sm border border-gray-50 p-4 flex flex-col items-center text-center ${meta.popular ? "ring-2 ring-[var(--color-primary)]" : ""}`}
                >
                  {meta.popular && (
                    <span className="absolute -top-2.5 bg-[var(--color-primary)] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                      BEST VALUE
                    </span>
                  )}
                  <p className="text-2xl font-bold text-[var(--color-text)] mt-1">Rs. {pkg.amount}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">{pkg.sms_count} SMS</p>
                  <p className="text-[10px] text-[var(--color-text-muted)]">
                    Rs. {(pkg.amount / pkg.sms_count).toFixed(2)}/SMS
                  </p>
                  <button
                    onClick={() => handleBuy(key)}
                    disabled={buying === key}
                    className={`mt-3 w-full py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r ${meta.color} active:scale-[0.97] transition-transform disabled:opacity-60 flex items-center justify-center gap-1.5`}
                  >
                    {buying === key ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      "Buy Now"
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* How It Works */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-50 p-4 space-y-2">
          <h3 className="font-semibold text-sm text-[var(--color-text)]">How it works</h3>
          <ol className="text-xs text-[var(--color-text-muted)] space-y-1 list-decimal list-inside">
            <li>Choose a package and click <strong>Buy Now</strong></li>
            <li>You will be redirected to eSewa to complete payment</li>
            <li>SMS credits are added automatically after successful payment</li>
            <li>Each SMS sent to a customer consumes 1 credit</li>
          </ol>
        </div>

        {/* Recharge History */}
        {logs.length > 0 && (
          <section>
            <h2 className="font-semibold text-[var(--color-text)] mb-3">Recharge History</h2>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-50 divide-y divide-gray-100">
              {logs.map((log: any) => (
                <div key={log.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text)]">
                      +{log.sms_count} SMS
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Rs. {Number(log.amount).toLocaleString()} &middot; {new Date(log.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      log.status === "completed"
                        ? "bg-green-100 text-green-700"
                        : log.status === "failed"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
