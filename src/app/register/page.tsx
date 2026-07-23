"use client";

import { useState, useEffect, useRef } from "react";
import { useToast } from "@/components/Toast";
import LogoWithAbout from "@/components/LogoWithAbout";

function maskPhone(phone: string): string {
  if (phone.length < 8) return phone;
  return phone.slice(0, 4) + "****" + phone.slice(-2);
}

export default function RegisterPage() {
  const { addToast } = useToast();

  // Steps: phone → otp → profile → done
  const [step, setStep] = useState<"phone" | "otp" | "profile" | "done" | "error">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inviteData, setInviteData] = useState<any>(null);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first OTP input on mount
  useEffect(() => {
    if (step === "otp") {
      otpRefs.current[0]?.focus();
    }
  }, [step]);

  // Auto-submit when all OTP digits entered (with guard against duplicate calls)
  const autoSubmitRef = useRef(false);
  useEffect(() => {
    if (step === "otp" && otp.every((d) => d !== "") && !verifying && !autoSubmitRef.current) {
      autoSubmitRef.current = true;
      handleVerifyOtp();
    }
  }, [otp, step, verifying]);

  // Handle phone submit — look up invite
  const handlePhoneSubmit = async () => {
    const clean = phone.replace(/\D/g, "");
    if (clean.length < 10) {
      addToast("Please enter a valid 10-digit phone number", "error");
      return;
    }

    setLoading(true);
    try {
      // Check if customer has a pending invite
      const inviteRes = await fetch("/api/verify/lookup-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: clean }),
      });

      if (inviteRes.ok) {
        const data = await inviteRes.json();
        if (data.invite) {
          setInviteData(data.invite);
          setStep("otp");
          addToast("Verification code sent to your phone!", "success");
        } else {
          setStep("profile");
          addToast("No pending invite found. Let's create your account.", "info");
        }
      } else {
        setStep("profile");
        addToast("Let's set up your account.", "info");
      }
    } catch {
      addToast("Network error. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP digit input
  const handleOtpDigit = (value: string, idx: number) => {
    if (!/^\d*$/.test(value)) return;
    const digit = value.slice(-1);
    const next = [...otp];
    next[idx] = digit;
    setOtp(next);
    setOtpError("");

    if (digit && idx < 5) {
      otpRefs.current[idx + 1]?.focus();
    }
  };

  // Handle backspace in OTP
  const handleOtpKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === "Backspace" && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
      const next = [...otp];
      next[idx - 1] = "";
      setOtp(next);
    }
  };

  // Verify OTP
  const handleVerifyOtp = async () => {
    const code = otp.join("");
    if (code.length !== 6) return;

    setVerifying(true);
    setOtpError("");

    try {
      const res = await fetch("/api/verify/confirm-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.replace(/\D/g, ""), otp: code }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setStep("profile");
          if (data.name) setName(data.name);
          addToast("Phone verified! Complete your profile.", "success");
        } else {
          setOtpError(data.error || "Invalid code. Please try again.");
          setOtp(["", "", "", "", "", ""]);
          otpRefs.current[0]?.focus();
        }
      } else {
        const data = await res.json().catch(() => ({}));
        setOtpError(data.error || "Verification failed. Please try again.");
        setOtp(["", "", "", "", "", ""]);
        otpRefs.current[0]?.focus();
      }
    } catch {
      setOtpError("Network error. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  // Save profile
  const handleSaveProfile = async () => {
    if (!name.trim()) {
      addToast("Please enter your name", "error");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/verify/complete-registration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.replace(/\D/g, ""),
          name: name.trim(),
          address: address.trim() || null,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setStep("done");
          addToast("Registration complete! Welcome to QR Hisab.", "success");
        } else {
          addToast(data.error || "Failed to save profile", "error");
        }
      } else {
        addToast("Failed to save profile. Please try again.", "error");
      }
    } catch {
      addToast("Network error. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[var(--color-bg)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4">
            <LogoWithAbout size={64} showAnimation />
          </div>
          <h1 className="text-2xl font-extrabold text-[var(--color-text)]">Create Account ✨</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {step === "phone" && "Enter your phone number to register"}
            {step === "otp" && `Enter the 6-digit code sent to ${maskPhone(phone)}`}
            {step === "profile" && "Complete your profile to get started"}
            {step === "done" && "Welcome to the family!"}
          </p>
        </div>

        {/* Step: Phone */}
        {step === "phone" && (
          <div className="bg-[var(--color-surface)] rounded-2xl p-6 shadow-sm border border-[var(--color-border)] space-y-4">
            <div>
              <label className="text-sm font-medium text-[var(--color-text)]">Phone Number</label>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">+977</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="98XXXXXXXX"
                  className="flex-1 px-4 py-3 bg-[var(--color-surface)] rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all text-center text-lg font-mono"
                  autoFocus
                />
              </div>
            </div>
            <button
              onClick={handlePhoneSubmit}
              disabled={loading || phone.replace(/\D/g, "").length < 10}
              className="w-full py-3 bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                "Continue"
              )}
            </button>
          </div>
        )}

        {/* Step: OTP */}
        {step === "otp" && (
          <div className="bg-[var(--color-surface)] rounded-2xl p-6 shadow-sm border border-[var(--color-border)] space-y-4">
            <div className="flex justify-center gap-1.5">
              {otp.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => { otpRefs.current[idx] = el; }}
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpDigit(e.target.value, idx)}
                  onKeyDown={(e) => handleOtpKeyDown(e, idx)}
                  className="w-[44px] h-14 text-center text-xl font-bold bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
                />
              ))}
            </div>
            {otpError && (
              <p role="alert" className="text-xs text-red-500 dark:text-red-400 text-center">{otpError}</p>
            )}
            {verifying && (
              <div className="flex justify-center">
                <div className="w-5 h-5 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            <button
              onClick={() => { setStep("phone"); setOtp(["", "", "", "", "", ""]); setOtpError(""); }}
              className="w-full text-xs text-[var(--color-primary)] font-medium py-3"
            >
              Change phone number
            </button>
          </div>
        )}

        {/* Step: Profile */}
        {step === "profile" && (
          <div className="bg-[var(--color-surface)] rounded-2xl p-6 shadow-sm border border-[var(--color-border)] space-y-4">
            <div>
              <label className="text-sm font-medium text-[var(--color-text)]">Your Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ram Sharma"
                className="w-full mt-1 px-4 py-3 bg-[var(--color-surface)] rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--color-text)]">Address (optional)</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Kathmandu"
                className="w-full mt-1 px-4 py-3 bg-[var(--color-surface)] rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
              />
            </div>
            <button
              onClick={handleSaveProfile}
              disabled={saving || !name.trim()}
              className="w-full py-3 bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                "Complete Registration"
              )}
            </button>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className="bg-[var(--color-surface)] rounded-2xl p-6 shadow-sm border border-gray-50 dark:border-gray-700 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[var(--color-text)]">Welcome, {name}! 🎉</h2>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                You&apos;re all set! Scan shop QR codes to start tracking your transactions.
              </p>
            </div>
            <a
              href="/login"
              className="block w-full py-3 bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] rounded-xl font-semibold active:scale-[0.98] transition-transform text-center"
            >
              Go to Login 🚀
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
