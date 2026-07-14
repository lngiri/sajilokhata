"use client";

import { useState, useRef, useEffect } from "react";
import { sendLoginOtp, verifyLoginOtp } from "@/app/actions/otp";

type Step = "phone" | "otp";

export default function LoginPage() {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [rememberMe, setRememberMe] = useState(true);
  const otpRef = useRef<HTMLInputElement>(null);

  // Silent session check on mount — skip login if already authenticated
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        const data: { userId: string | null } = await res.json();
        if (cancelled) return;
        if (data.userId) {
          window.location.replace("/merchant/dashboard");
          return;
        }
      } catch {
        // Network error — show login form
      }
      if (!cancelled) setCheckingSession(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const handlePhoneSubmit = async () => {
    if (!phone || phone.length < 10) return;
    setLoading(true);
    setError("");

    const result = await sendLoginOtp(phone);

    if (!result.success) {
      setError(result.error || "Failed to send OTP. Please try again.");
      setLoading(false);
      return;
    }

    setStep("otp");
    setLoading(false);
  };

  const handleOtpSubmit = async () => {
    if (otp.length < 4) return;
    setLoading(true);
    setError("");

    const result = await verifyLoginOtp(phone, otp, rememberMe);

    if (!result.success) {
      setError(result.error || "Invalid OTP. Please try again.");
      setLoading(false);
      return;
    }

    // ── Secure login: wipe ALL previous state before setting new identity ──
    localStorage.clear();
    sessionStorage.clear();
    try {
      const { clearIndexedDB } = await import("@/lib/offline/db");
      await clearIndexedDB();
    } catch { /* ignore */ }
    document.cookie.split(";").forEach((c) => {
      const name = c.trim().split("=")[0];
      document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; max-age=0`;
    });
    if ("caches" in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch { /* ignore */ }
    }

    if (result.userId) {
      localStorage.setItem("merchant_id", result.userId);
    }
    if (result.phone) {
      localStorage.setItem("merchant_phone", result.phone);
    }

    window.location.replace(`/merchant/dashboard?status=${result.userId ? "existing" : "new"}`);
  };

  if (checkingSession) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 py-12 bg-[var(--color-bg)]">
        <div className="w-12 h-12 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-sm text-[var(--color-text-muted)]">Checking session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 py-12 bg-[var(--color-bg)]">
      {/* Logo */}
      <div className="mb-8 text-center animate-fade-in">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] flex items-center justify-center shadow-lg">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className="text-2xl font-extrabold text-[var(--color-primary)]">QR Hisab</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">Digital Diary</p>
      </div>

      {step === "phone" ? (
        <div className="w-full space-y-4 animate-fade-in">
          <div>
            <label className="text-sm font-medium text-[var(--color-text)]">Shop Phone Number</label>
            <div className="flex mt-1">
              <span className="px-3 py-3 bg-gray-100 rounded-l-xl text-sm font-medium text-gray-500 border border-r-0 border-gray-100">
                +977
              </span>
              <input
                type="tel"
                placeholder="9841234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                className="flex-1 px-4 py-3 bg-white rounded-r-xl text-lg font-mono border border-gray-100 focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none"
                maxLength={10}
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-xl">{error}</div>
          )}

          <div className="flex items-center gap-2">
            <input
              id="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
            />
            <label htmlFor="remember-me" className="text-sm text-[var(--color-text-muted)] cursor-pointer select-none">
              Remember me for 30 days
            </label>
          </div>

          <button
            onClick={handlePhoneSubmit}
            disabled={phone.length < 10 || loading}
            className="w-full py-3.5 bg-[var(--color-primary)] text-white rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              "Send OTP"
            )}
          </button>
        </div>
      ) : (
        <div className="w-full space-y-4 animate-fade-in">
          <div className="bg-[var(--color-primary)]/5 rounded-xl p-3 text-center">
            <p className="text-xs text-[var(--color-text-muted)]">
              OTP sent to <span className="font-medium text-[var(--color-text)]">+977{phone}</span>
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-[var(--color-text)]">Enter OTP</label>
            <input
              ref={otpRef}
              type="text"
              placeholder="4-6 digit code"
              value={otp}
              onChange={(e) => {
                const filtered = e.target.value.replace(/\D/g, "").slice(0, 6);
                setOtp(filtered);
                requestAnimationFrame(() => {
                  if (otpRef.current) {
                    const pos = Math.min(e.target.selectionStart || filtered.length, filtered.length);
                    otpRef.current.setSelectionRange(pos, pos);
                  }
                });
              }}
              className="w-full mt-1 px-4 py-3 bg-white rounded-xl text-2xl font-mono text-center border border-gray-100 focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none tracking-widest"
              maxLength={6}
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-xl">{error}</div>
          )}

          <button
            onClick={handleOtpSubmit}
            disabled={otp.length < 4 || loading}
            className="w-full py-3.5 bg-[var(--color-primary)] text-white rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              "Verify & Login"
            )}
          </button>

          <button
            onClick={() => { setStep("phone"); setError(""); }}
            className="w-full text-center text-sm text-[var(--color-text-muted)] active:text-[var(--color-primary)] transition-colors"
          >
            Change phone number
          </button>
        </div>
      )}
    </div>
  );
}
