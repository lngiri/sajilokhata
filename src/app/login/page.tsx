"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

type Step = "phone" | "otp";

/** Bypass codes that skip real Supabase OTP verification during testing */
const BYPASS_CODES = ["123456", "000000"];

export default function LoginPage() {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const otpRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  const handlePhoneSubmit = async () => {
    if (!phone || phone.length < 10) return;
    setLoading(true);
    setError("");

    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: `+977${phone}`,
      });

      if (error) {
        console.warn("OTP send failed (demo mode):", error.message);
      }
      setStep("otp");
    } catch {
      setStep("otp");
    } finally {
      setLoading(false);
    }
  };

  const signInWithPhoneAndPassword = async (password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      phone: `+977${phone}`,
      password,
    });

    if (error) throw error;
    return data;
  };

  const handleOtpSubmit = async () => {
    if (otp.length < 4) return;
    setLoading(true);
    setError("");

    try {
      // === BYPASS CODES for testing (pre-revenue phase) ===
      if (BYPASS_CODES.includes(otp)) {
        console.info("🔓 Bypass code entered — attempting auto-authentication");

        // 1. Try to create/get a real Supabase auth user via admin API
        const res = await fetch("/api/auth/bypass", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: `+977${phone}` }),
        });

        const bypassResult = await res.json();

        if (res.ok && bypassResult.password) {
          // Admin API worked — sign in with phone + password to get a real session
          await signInWithPhoneAndPassword(bypassResult.password);
          const userId = bypassResult.user_id;
          localStorage.setItem("merchant_id", userId);
          window.location.href = "/merchant/dashboard";
          return;
        }

        // 2. Fallback: no service_role key, use localStorage bypass
        console.warn(
          "⚠️ Admin API unavailable, using localStorage bypass. RLS policies will limit database access."
        );

        // Store the bypass info for the middleware (1-year expiry)
        document.cookie = `auth_bypass=true; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`;
        document.cookie = `auth_bypass_phone=${phone}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`;

        const fallbackId =
          bypassResult.bypass_id || `bypass-${phone}-${Date.now()}`;
        localStorage.setItem("merchant_id", fallbackId);
        // Create a minimal merchants row so FK constraints work
        let status = "new";
        try {
          const setupRes = await fetch("/api/merchant/setup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              merchant_id: fallbackId,
              phone: `+977${phone}`,
            }),
          });
          const setupData = await setupRes.json();
          if (setupRes.ok && setupData.merchant_id) {
            localStorage.setItem("merchant_id", setupData.merchant_id);
            status = setupData.existed ? "existing" : "new";
          } else {
            // Show API error as alert for now
            console.warn("Merchant setup failed:", setupData.error);
          }
        } catch {
          // API not available — merchant can set up profile later
        }
        window.location.href = `/merchant/dashboard?status=${status}`;
        return;
      }

      // === NORMAL OTP FLOW (real Supabase SMS) ===
      const { data, error } = await supabase.auth.verifyOtp({
        phone: `+977${phone}`,
        token: otp,
        type: "sms",
      });

      if (error) {
        setError("Invalid OTP. Please try again.");
        setLoading(false);
        return;
      }

      if (data.session) {
        localStorage.setItem("merchant_id", data.session.user.id);
        // Create a minimal merchants row so FK constraints work
        let status = "new";
        try {
          const setupRes = await fetch("/api/merchant/setup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              merchant_id: data.session.user.id,
              phone: `+977${phone}`,
            }),
          });
          const setupData = await setupRes.json();
          if (setupRes.ok && setupData.merchant_id) {
            localStorage.setItem("merchant_id", setupData.merchant_id);
            status = setupData.existed ? "existing" : "new";
          }
        } catch {
          // Non-critical — merchant can set up profile later
        }
        window.location.href = `/merchant/dashboard?status=${status}`;
      }
    } catch {
      const fallbackId = crypto.randomUUID();
      document.cookie = `auth_bypass=true; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`;
      document.cookie = `auth_bypass_phone=${phone}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`;
      localStorage.setItem("merchant_id", fallbackId);
      window.location.href = "/merchant/dashboard";
    } finally {
      setLoading(false);
    }
  };

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

          <button
            onClick={async () => {
              const id = crypto.randomUUID();
              localStorage.setItem("merchant_id", id);
              // Create a minimal merchants row so FK constraints work
              let status = "new";
              try {
                const setupRes = await fetch("/api/merchant/setup", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    merchant_id: id,
                    phone: `+977${phone}` || "",
                  }),
                });
                const setupData = await setupRes.json();
                if (setupRes.ok && setupData.merchant_id) {
                  localStorage.setItem("merchant_id", setupData.merchant_id);
                  status = setupData.existed ? "existing" : "new";
                }
              } catch {
                // API not available — merchant can set up profile later
              }
              window.location.href = `/merchant/dashboard?status=${status}`;
            }}
            className="w-full text-center text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)] active:text-[var(--color-primary)] transition-colors"
          >
            Skip for demo →
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
