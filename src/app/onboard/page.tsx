"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { sendRegistrationOtp, verifyRegistrationOtp } from "@/app/actions/otp";

type Step = "phone" | "otp" | "done";

export default function OnboardPage() {
  const searchParams = useSearchParams();
  const prefilled = searchParams?.get("phone") || "";

  const [step, setStep] = useState<Step>(prefilled ? "otp" : "phone");
  const [phone, setPhone] = useState(prefilled);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Auto-send OTP if phone was prefilled from URL
  useEffect(() => {
    if (prefilled) {
      sendRegistrationOtp(prefilled).catch(() => {});
    }
  }, [prefilled]);

  const handleSendOtp = async () => {
    if (phone.length < 10) return;
    setLoading(true);
    setError("");
    const res = await sendRegistrationOtp(phone);
    if (!res.success) {
      setError(res.error || "Failed to send OTP");
      setLoading(false);
      return;
    }
    setStep("otp");
    setLoading(false);
  };

  const handleVerifyOtp = async () => {
    if (otp.length < 4) return;
    setLoading(true);
    setError("");
    const res = await verifyRegistrationOtp(phone, otp);
    if (!res.success) {
      setError(res.error || "Invalid OTP");
      setLoading(false);
      return;
    }
    if (res.userId) localStorage.setItem("merchant_id", res.userId);
    if (res.phone) localStorage.setItem("merchant_phone", res.phone);
    setStep("done");
    setLoading(false);
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 py-12 bg-[var(--color-bg)]">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] flex items-center justify-center shadow-lg">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-extrabold text-[var(--color-primary)]">QR Hisab</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Customer Onboarding</p>

        {step === "phone" && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-text-muted)]">Enter your phone number to get started</p>
            <input
              type="tel"
              placeholder="9841234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              className="w-full px-4 py-3 bg-white rounded-xl text-lg font-mono border border-gray-200 text-center focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none"
              maxLength={10}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
              onClick={handleSendOtp}
              disabled={loading || phone.length < 10}
              className="w-full py-3 bg-[var(--color-primary)] text-white rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send OTP"}
            </button>
          </div>
        )}

        {step === "otp" && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-text-muted)]">Enter the OTP sent to +977{phone}</p>
            <input
              ref={(input) => { if (input) { input.focus(); input.inputMode = "numeric"; }}}
              type="text"
              inputMode="numeric"
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="w-full px-4 py-3 bg-white rounded-xl text-2xl font-mono text-center tracking-[0.5em] border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none"
              maxLength={6}
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
              onClick={handleVerifyOtp}
              disabled={loading || otp.length < 4}
              className="w-full py-3 bg-[var(--color-primary)] text-white rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Verify & Onboard"}
            </button>
            <button
              onClick={() => { setStep("phone"); setOtp(""); setError(""); }}
              className="text-sm text-[var(--color-text-muted)] underline"
            >
              Change phone number
            </button>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-4">
            <p className="text-lg font-bold text-[var(--color-text)]">Welcome to QR Hisab!</p>
            <p className="text-sm text-[var(--color-text-muted)]">
              Your account has been created. You can now view and manage your transactions.
            </p>
            <a
              href="/customer/dashboard"
              className="block w-full py-3 bg-[var(--color-primary)] text-white rounded-xl font-semibold"
            >
              Go to Dashboard
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
