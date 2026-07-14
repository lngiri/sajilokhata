"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { sendLoginOtp, verifyLoginOtp } from "@/app/actions/otp";
import { checkHasPin, verifyPin, setPin as setMerchantPin, forgotPinSendOtp, forgotPinVerifyOtp } from "@/app/actions/pin";

type Step =
  | "loading"
  | "pin"
  | "set_pin"
  | "phone"
  | "otp"
  | "forgot_phone"
  | "forgot_otp"
  | "forgot_set_pin";

export default function LoginPage() {
  const [step, setStep] = useState<Step>("loading");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [pin, setPin] = useState(["", "", "", ""]);
  const [newPin, setNewPin] = useState(["", "", "", ""]);
  const [confirmPin, setConfirmPin] = useState(["", "", "", ""]);
  const pinRefs = useRef<(HTMLInputElement | null)[]>([null, null, null, null]);
  const newPinRefs = useRef<(HTMLInputElement | null)[]>([null, null, null, null]);
  const confirmPinRefs = useRef<(HTMLInputElement | null)[]>([null, null, null, null]);
  const otpRef = useRef<HTMLInputElement>(null);

  // Silent session check on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        const data: { userId: string | null } = await res.json();
        if (cancelled) return;
        if (data.userId) {
          setMerchantId(data.userId);
          const { hasPin } = await checkHasPin(data.userId);
          if (cancelled) return;
          if (hasPin) {
            setStep("pin");
          } else {
            setStep("set_pin");
          }
          return;
        }
      } catch {
        // Network error
      }
      if (!cancelled) setStep("phone");
    })();
    return () => { cancelled = true; };
  }, []);

  const focusPinInput = useCallback((refs: React.MutableRefObject<(HTMLInputElement | null)[]>, idx: number) => {
    if (idx >= 0 && idx < 4) {
      refs.current[idx]?.focus();
    }
  }, []);

  const handlePinDigit = (
    value: string,
    idx: number,
    pinArr: string[],
    setter: (v: string[]) => void,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>,
  ) => {
    if (!/^\d*$/.test(value)) return;
    const digit = value.slice(-1);
    const next = [...pinArr];
    next[idx] = digit;
    setter(next);
    if (digit && idx < 3) {
      focusPinInput(refs, idx + 1);
    }
  };

  const handlePinKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    idx: number,
    pinArr: string[],
    setter: (v: string[]) => void,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>,
  ) => {
    if (e.key === "Backspace" && !pinArr[idx] && idx > 0) {
      const next = [...pinArr];
      next[idx - 1] = "";
      setter(next);
      focusPinInput(refs, idx - 1);
    }
  };

  const pinArrayToString = (arr: string[]) => arr.join("");

  // ── PIN Entry ──
  const handlePinSubmit = async () => {
    const pinStr = pinArrayToString(pin);
    if (pinStr.length < 4) return;
    if (!merchantId) return;
    setLoading(true);
    setError("");
    const result = await verifyPin(merchantId, pinStr);
    if (!result.success) {
      setError(result.error || "Incorrect PIN");
      setPin(["", "", "", ""]);
      focusPinInput(pinRefs, 0);
      setLoading(false);
      return;
    }
    window.location.replace("/merchant/dashboard");
  };

  // ── Set PIN ──
  const handleSetPin = async () => {
    const newPinStr = pinArrayToString(newPin);
    const confirmStr = pinArrayToString(confirmPin);
    if (newPinStr.length < 4) { setError("Enter a 4-digit PIN"); return; }
    if (newPinStr !== confirmStr) { setError("PINs do not match"); return; }
    if (!merchantId) return;
    setLoading(true);
    setError("");
    const result = await setMerchantPin(merchantId, newPinStr);
    if (!result.success) {
      setError(result.error || "Failed to set PIN");
      setLoading(false);
      return;
    }
    window.location.replace("/merchant/dashboard");
  };

  const handleSkipPin = () => {
    window.location.replace("/merchant/dashboard");
  };

  // ── OTP Phone Submit ──
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

  // ── OTP Verify ──
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
      setMerchantId(result.userId);
    }
    if (result.phone) {
      localStorage.setItem("merchant_phone", result.phone);
    }

    // Check if PIN already set
    const { hasPin } = await checkHasPin(result.userId!);
    if (hasPin) {
      window.location.replace(`/merchant/dashboard?status=${result.userId ? "existing" : "new"}`);
    } else {
      setStep("set_pin");
      setLoading(false);
    }
  };

  // ── Forgot PIN: Send OTP ──
  const handleForgotPhoneSubmit = async () => {
    if (!phone || phone.length < 10) return;
    setLoading(true);
    setError("");
    const result = await forgotPinSendOtp(phone);
    if (!result.success) {
      setError(result.error || "Failed to send OTP");
      setLoading(false);
      return;
    }
    setStep("forgot_otp");
    setLoading(false);
  };

  // ── Forgot PIN: Verify OTP + Set new PIN ──
  const handleForgotOtpSubmit = async () => {
    if (otp.length < 4) return;
    const newPinStr = pinArrayToString(newPin);
    if (newPinStr.length < 4) { setError("Enter a new 4-digit PIN"); return; }
    const confirmStr = pinArrayToString(confirmPin);
    if (newPinStr !== confirmStr) { setError("PINs do not match"); return; }
    setLoading(true);
    setError("");
    const result = await forgotPinVerifyOtp(phone, otp, newPinStr);
    if (!result.success) {
      setError(result.error || "Verification failed");
      setLoading(false);
      return;
    }
    window.location.replace("/merchant/dashboard");
  };

  const backToPin = () => { setStep("pin"); setError(""); setPhone(""); };

  if (step === "loading") {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 py-12 bg-[var(--color-bg)]">
        <div className="w-12 h-12 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-sm text-[var(--color-text-muted)]">Checking session...</p>
      </div>
    );
  }

  const renderPinDots = (
    pinArr: string[],
    setter: (v: string[]) => void,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>,
    label: string,
  ) => (
    <div>
      <label className="block text-sm font-medium text-[var(--color-text)] mb-3 text-center">{label}</label>
      <div className="flex justify-center gap-3">
        {pinArr.map((d, i) => (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            type="tel"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={(e) => handlePinDigit(e.target.value, i, pinArr, setter, refs)}
            onKeyDown={(e) => handlePinKeyDown(e, i, pinArr, setter, refs)}
            onFocus={(e) => e.target.select()}
            className="w-14 h-14 text-center text-2xl font-bold bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
          />
        ))}
      </div>
    </div>
  );

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

      {/* ── PIN Entry ── */}
      {step === "pin" && (
        <div className="w-full max-w-xs space-y-6 animate-fade-in">
          {renderPinDots(pin, setPin, pinRefs, "Enter your PIN")}

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-xl text-center">{error}</div>
          )}

          <button
            onClick={handlePinSubmit}
            disabled={pinArrayToString(pin).length < 4 || loading}
            className="w-full py-3.5 bg-[var(--color-primary)] text-white rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              "Unlock"
            )}
          </button>

          <button
            onClick={() => { setStep("forgot_phone"); setError(""); setPhone(""); }}
            className="w-full text-center text-sm text-[var(--color-text-muted)] active:text-[var(--color-primary)] transition-colors"
          >
            Forgot PIN?
          </button>
        </div>
      )}

      {/* ── Set PIN (after OTP login or when no PIN set) ── */}
      {step === "set_pin" && (
        <div className="w-full max-w-xs space-y-6 animate-fade-in">
          <p className="text-sm text-[var(--color-text-muted)] text-center">
            Set a 4-digit PIN for quick login next time
          </p>

          {renderPinDots(newPin, setNewPin, newPinRefs, "New PIN")}
          {renderPinDots(confirmPin, setConfirmPin, confirmPinRefs, "Confirm PIN")}

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-xl text-center">{error}</div>
          )}

          <button
            onClick={handleSetPin}
            disabled={pinArrayToString(newPin).length < 4 || pinArrayToString(confirmPin).length < 4 || loading}
            className="w-full py-3.5 bg-[var(--color-primary)] text-white rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              "Set PIN & Continue"
            )}
          </button>

          <button
            onClick={handleSkipPin}
            className="w-full text-center text-sm text-[var(--color-text-muted)] active:text-[var(--color-primary)] transition-colors"
          >
            Skip for now
          </button>
        </div>
      )}

      {/* ── OTP Phone Entry ── */}
      {(step === "phone" || step === "forgot_phone") && (
        <div className="w-full max-w-xs space-y-4 animate-fade-in">
          <p className="text-sm text-[var(--color-text-muted)] text-center">
            {step === "forgot_phone" ? "Enter your registered phone to reset PIN" : "Sign in with your shop phone"}
          </p>

          <div>
            <label className="text-sm font-medium text-[var(--color-text)]">Phone Number</label>
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

          {step === "phone" && (
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
          )}

          <button
            onClick={step === "phone" ? handlePhoneSubmit : handleForgotPhoneSubmit}
            disabled={phone.length < 10 || loading}
            className="w-full py-3.5 bg-[var(--color-primary)] text-white rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              step === "forgot_phone" ? "Send Reset OTP" : "Send OTP"
            )}
          </button>

          {step === "forgot_phone" && (
            <button
              onClick={backToPin}
              className="w-full text-center text-sm text-[var(--color-text-muted)] active:text-[var(--color-primary)] transition-colors"
            >
              Back to PIN entry
            </button>
          )}
        </div>
      )}

      {/* ── OTP Verify ── */}
      {(step === "otp" || step === "forgot_otp") && (
        <div className="w-full max-w-xs space-y-4 animate-fade-in">
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

          {/* For forgot_otp: show PIN set fields before OTP submit */}
          {step === "forgot_otp" && (
            <div className="space-y-4 pt-2 border-t border-gray-100">
              <p className="text-xs text-[var(--color-text-muted)] text-center">Set a new 4-digit PIN</p>
              {renderPinDots(newPin, setNewPin, newPinRefs, "New PIN")}
              {renderPinDots(confirmPin, setConfirmPin, confirmPinRefs, "Confirm PIN")}
            </div>
          )}

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-xl">{error}</div>
          )}

          <button
            onClick={step === "otp" ? handleOtpSubmit : handleForgotOtpSubmit}
            disabled={otp.length < 4 || loading || (step === "forgot_otp" && (pinArrayToString(newPin).length < 4 || pinArrayToString(confirmPin).length < 4))}
            className="w-full py-3.5 bg-[var(--color-primary)] text-white rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              step === "forgot_otp" ? "Verify & Reset PIN" : "Verify & Login"
            )}
          </button>

          <button
            onClick={() => { setStep(step === "otp" ? "phone" : "forgot_phone"); setError(""); }}
            className="w-full text-center text-sm text-[var(--color-text-muted)] active:text-[var(--color-primary)] transition-colors"
          >
            {step === "otp" ? "Change phone number" : "Back"}
          </button>
        </div>
      )}

      {/* ── Forgot PIN: Set new PIN (after OTP verified) ── */}
      {step === "forgot_set_pin" && (
        <div className="w-full max-w-xs space-y-6 animate-fade-in">
          <p className="text-sm text-[var(--color-text-muted)] text-center">
            Set a new 4-digit PIN
          </p>
          {renderPinDots(newPin, setNewPin, newPinRefs, "New PIN")}
          {renderPinDots(confirmPin, setConfirmPin, confirmPinRefs, "Confirm PIN")}
          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-xl text-center">{error}</div>
          )}
          <button
            onClick={handleForgotOtpSubmit}
            disabled={pinArrayToString(newPin).length < 4 || pinArrayToString(confirmPin).length < 4 || loading}
            className="w-full py-3.5 bg-[var(--color-primary)] text-white rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              "Reset PIN & Continue"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
