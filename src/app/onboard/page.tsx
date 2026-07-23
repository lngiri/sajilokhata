"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { sendRegistrationOtp, verifyRegistrationOtp } from "@/app/actions/otp";
import { registerNewUser } from "@/app/actions/pin";
import LogoWithAbout from "@/components/LogoWithAbout";

type Step = "phone" | "otp" | "done";

export default function OnboardPage() {
  const searchParams = useSearchParams();
  const prefilled = searchParams?.get("phone") || "";

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState(prefilled);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(!!prefilled);
  const [error, setError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState("");

  // Auto-send OTP if phone was prefilled from URL
  useEffect(() => {
    if (prefilled) {
      setSendingOtp(true);
      setError("");
      sendRegistrationOtp(prefilled)
        .then((res) => {
          if (res.success) {
            setStep("otp");
            setResendCooldown(30);
          } else {
            setError(res.error || "Failed to send OTP. Please try again.");
          }
        })
        .catch(() => {
          setError("Network error. Please try again.");
        })
        .finally(() => {
          setSendingOtp(false);
        });
    }
  }, [prefilled]);

  // Resend cooldown countdown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

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
    setResendCooldown(30);
    setLoading(false);
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || loading) return;
    setLoading(true);
    setError("");
    setResendMessage("");
    const res = await sendRegistrationOtp(phone);
    if (!res.success) {
      setError(res.error || "Failed to resend OTP");
      setLoading(false);
      return;
    }
    setResendCooldown(30);
    setResendMessage("OTP resent!");
    setLoading(false);
    setTimeout(() => setResendMessage(""), 4000);
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

    if (!res.exists) {
      const reg = await registerNewUser(phone, "customer");
      if (!reg.success) {
        setError(reg.error || "Failed to create account");
        setLoading(false);
        return;
      }
      if (reg.userId) localStorage.setItem("merchant_id", reg.userId);
      if (reg.phone) localStorage.setItem("merchant_phone", reg.phone);
    } else {
      if (res.userId) localStorage.setItem("merchant_id", res.userId);
      if (res.phone) localStorage.setItem("merchant_phone", res.phone);
    }
    setStep("done");
    setLoading(false);
  };

  const handleChangePhone = () => {
    setStep("phone");
    setOtp("");
    setError("");
    setResendCooldown(0);
    setResendMessage("");
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 py-12 bg-[var(--color-bg)]">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="mx-auto">
          <LogoWithAbout size={64} showAnimation />
        </div>
        <h1 className="text-2xl font-extrabold text-[var(--color-text)]">Welcome! 👋</h1>
        <p className="text-sm text-[var(--color-text-muted)]">Let&apos;s get you set up with QR Hisab</p>

        {sendingOtp && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div role="status" aria-live="polite" className="w-8 h-8 border-[3px] border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-[var(--color-text-muted)]">Sending OTP...</p>
          </div>
        )}

        {!sendingOtp && step === "phone" && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-text-muted)]">Enter your phone number to get started</p>
            <input
              type="tel"
              placeholder="9841234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              className="w-full px-4 py-3 bg-[var(--color-surface)] rounded-xl text-lg font-mono border border-[var(--color-border)] text-center focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none"
              maxLength={10}
            />
            {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
            <button
              onClick={handleSendOtp}
              disabled={loading || phone.length < 10}
              className="w-full py-3 bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send OTP"}
            </button>
          </div>
        )}

        {step === "otp" && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-text-muted)]">Enter the OTP sent to +977{phone}</p>
            <input
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="w-full px-4 py-3 bg-[var(--color-surface)] rounded-xl text-2xl font-mono text-center tracking-[0.5em] border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none"
              maxLength={6}
              autoFocus
            />
            {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
            {resendMessage && <p className="text-sm text-green-600">{resendMessage}</p>}
            <button
              onClick={handleVerifyOtp}
              disabled={loading || otp.length < 4}
              className="w-full py-3 bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Verify & Onboard"}
            </button>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || loading}
                className="text-sm font-medium text-[var(--color-primary)] active:opacity-70 disabled:text-gray-300 dark:disabled:text-gray-600 disabled:cursor-not-allowed transition-colors py-2"
              >
                {resendCooldown > 0 ? `Resend OTP (${resendCooldown}s)` : "Resend OTP"}
              </button>
              <span className="text-gray-200 dark:text-gray-600">|</span>
              <button
                onClick={handleChangePhone}
                className="text-sm text-[var(--color-text-muted)] underline active:opacity-70 py-2"
              >
                Change phone
              </button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-[var(--color-primary)]/15 flex items-center justify-center mb-2">
              <svg viewBox="0 0 32 32" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="16" cy="16" r="12" stroke="#22C55E" fill="#22C55E15" />
                <path d="M10 16l4 4 8-8" stroke="#22C55E" />
              </svg>
            </div>
            <p className="text-lg font-bold text-[var(--color-text)]">You&apos;re all set! 🎉</p>
            <p className="text-sm text-[var(--color-text-muted)]">
              Your account is ready. Time to start tracking your transactions!
            </p>
            <a
              href="/customer/dashboard"
              className="block w-full py-3.5 bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] rounded-[var(--radius-button)] font-bold active:scale-[0.98] transition-transform shadow-sm"
            >
              Go to Dashboard 🚀
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
