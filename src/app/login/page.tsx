"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { sendRegistrationOtp, verifyRegistrationOtp } from "@/app/actions/otp";
import { checkUserExists, verifyPin, setPin as setMerchantPin, loginWithPin, forgotPinSendOtp, forgotPinVerifyOtp, registerNewUser } from "@/app/actions/pin";

type Step =
  | "loading"
  | "phone"
  | "pin"
  | "set_pin"
  | "otp"
  | "select_role"
  | "forgot_phone"
  | "forgot_otp";

type SelectRoleMode = "register" | "login";

export default function LoginPage() {
  const [step, setStep] = useState<Step>("loading");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pin, setPin] = useState(["", "", "", ""]);
  const [newPin, setNewPin] = useState(["", "", "", ""]);
  const [confirmPin, setConfirmPin] = useState(["", "", "", ""]);
  const pinRefs = useRef<(HTMLInputElement | null)[]>([null, null, null, null]);
  const newPinRefs = useRef<(HTMLInputElement | null)[]>([null, null, null, null]);
  const confirmPinRefs = useRef<(HTMLInputElement | null)[]>([null, null, null, null]);
  const otpRef = useRef<HTMLInputElement>(null);
  // Track user info after lookup
  const userInfoRef = useRef<{ userId: string; userType: "merchant" | "customer" | "both" } | null>(null);
  const [selectRoleMode, setSelectRoleMode] = useState<SelectRoleMode>("register");
  const [availableRoles, setAvailableRoles] = useState<("merchant" | "customer")[]>(["merchant", "customer"]);

  const focusPinInput = useCallback((refs: React.MutableRefObject<(HTMLInputElement | null)[]>, idx: number) => {
    if (idx >= 0 && idx < 4) refs.current[idx]?.focus();
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
    if (digit && idx < 3) focusPinInput(refs, idx + 1);
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

  // ── Silent session check on mount ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        const data: { userId: string | null; roles: string[] } = await res.json();
        console.log("[Login] Mount session check:", JSON.stringify(data));
        if (cancelled) return;
        if (data.userId) {
          if (data.roles.length === 0) {
            console.log("[Login] Session exists but no roles → showing phone");
            if (!cancelled) setStep("phone");
            return;
          }
          if (data.roles.length === 1) {
            const target = data.roles[0] === "merchant" ? "/merchant/dashboard" : "/customer/dashboard";
            console.log("[Login] Single role, redirecting to", target);
            window.location.replace(target);
            return;
          }
          console.log("[Login] Both roles, redirecting to /select-role");
          window.location.replace("/select-role");
          return;
        }
      } catch (e) { console.log("[Login] Session check failed:", e); }
      if (!cancelled) setStep("phone");
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Phone Submit ──
  const handlePhoneSubmit = async () => {
    if (!phone || phone.length < 10) return;
    setLoading(true);
    setError("");

    console.log("[Login] Phone submit, checking existence for:", phone);
    const { exists, users } = await checkUserExists(phone);
    console.log("[Login] checkUserExists result:", { exists, users });

    if (!exists) {
      console.log("[Login] New user → sending OTP");
      const result = await sendRegistrationOtp(phone);
      if (!result.success) {
        console.log("[Login] OTP send failed:", result.error);
        setError(result.error || "Failed to send OTP");
        setLoading(false);
        return;
      }
      console.log("[Login] OTP sent, transitioning to otp step");
      setStep("otp");
      setLoading(false);
      return;
    }

    // Existing user — check for multi-role
    if (users.length > 1 || users[0]?.userType === "both") {
      console.log("[Login] Multi-role user → showing role selector");
      setAvailableRoles(users.map((u) => u.userType as "merchant" | "customer"));
      setSelectRoleMode("login");
      setStep("select_role");
      setLoading(false);
      return;
    }

    const user = users[0];
    userInfoRef.current = { userId: user.userId, userType: user.userType };
    console.log("[Login] Existing user:", userInfoRef.current);

    if (user.hasPin) {
      console.log("[Login] User has PIN → showing PIN entry");
      setStep("pin");
    } else {
      console.log("[Login] User has no PIN → showing set_pin");
      setStep("set_pin");
    }
    setLoading(false);
  };

  // ── PIN Entry ──
  const handlePinSubmit = async () => {
    const pinStr = pinArrayToString(pin);
    if (pinStr.length < 4) return;
    const info = userInfoRef.current;
    if (!info) return;
    setLoading(true);
    setError("");

    console.log("[Login] Verifying PIN for user:", info.userId);
    const result = await loginWithPin(info.userId, pinStr, info.userType);
    console.log("[Login] loginWithPin result:", JSON.stringify(result));
    if (!result.success) {
      setError(result.error || "Incorrect PIN");
      setPin(["", "", "", ""]);
      focusPinInput(pinRefs, 0);
      setLoading(false);
      return;
    }

    console.log("[Login] PIN verified, redirecting to", result.redirect);
    window.location.replace(result.redirect || "/merchant/dashboard");
  };

  // ── Set PIN (legacy user or after OTP) ──
  const handleSetPin = async () => {
    const newPinStr = pinArrayToString(newPin);
    const confirmStr = pinArrayToString(confirmPin);
    if (newPinStr.length < 4) { setError("Enter a 4-digit PIN"); return; }
    if (newPinStr !== confirmStr) { setError("PINs do not match"); return; }

    const info = userInfoRef.current;
    if (!info) {
      console.log("[Login] Set PIN: no userInfoRef, cannot proceed");
      setError("Session expired. Please re-enter your phone.");
      setStep("phone");
      return;
    }
    setLoading(true);
    setError("");

    console.log("[Login] Setting PIN for user:", info.userId, "type:", info.userType);
    const result = await setMerchantPin(info.userId, newPinStr);
    console.log("[Login] setPin result:", JSON.stringify(result));
    if (!result.success) {
      setError(result.error || "Failed to set PIN");
      setLoading(false);
      return;
    }

    const target = info.userType === "customer" ? "/customer/dashboard" : "/merchant/dashboard";
    console.log("[Login] PIN set successfully, redirecting to", target);
    window.location.replace(target);
  };

  const handleSkipPin = () => {
    const info = userInfoRef.current;
    const target = info?.userType === "customer" ? "/customer/dashboard"
      : info?.userType === "merchant" ? "/merchant/dashboard"
      : info?.userType === "both" ? "/select-role"
      : "/merchant/dashboard";
    console.log("[Login] Skipping PIN, redirecting to", target);
    window.location.replace(target);
  };

  // ── OTP Verify (new user registration) ──
  const handleOtpSubmit = async () => {
    if (otp.length < 4) return;
    setLoading(true);
    setError("");

    console.log("[Login] Verifying OTP for phone:", phone);
    const result = await verifyRegistrationOtp(phone, otp);
    console.log("[Login] verifyRegistrationOtp result:", JSON.stringify(result));
    if (!result.success) {
      setError(result.error || "Invalid OTP");
      setLoading(false);
      return;
    }

    if (!result.exists) {
      // New user — need role selection before creating account
      console.log("[Login] New user, no existing account → role selection");
      setSelectRoleMode("register");
      setAvailableRoles(["merchant", "customer"]);
      // Store phone in userInfoRef for use after role selection
      userInfoRef.current = null;
      setStep("select_role");
      setLoading(false);
      return;
    }

    // Existing user
    // Wipe previous state
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
      console.log("[Login] Stored merchant_id in localStorage:", result.userId);
    }
    if (result.phone) {
      localStorage.setItem("merchant_phone", result.phone);
    }

    const userType = result.userType || "merchant";
    userInfoRef.current = { userId: result.userId!, userType };
    console.log("[Login] OTP verified for existing user:", userInfoRef.current);

    // Check if PIN already set
    const hasPin = result.hasPin;
    console.log("[Login] PIN check after OTP:", { hasPin, userType });
    if (userType === "both") {
      // Multi-role existing user — let them choose
      console.log("[Login] Multi-role after OTP → role selection");
      setSelectRoleMode("login");
      setAvailableRoles(["merchant", "customer"]);
      setStep("select_role");
      setLoading(false);
      return;
    }
    if (hasPin) {
      const target = userType === "customer" ? "/customer/dashboard" : "/merchant/dashboard";
      console.log("[Login] PIN already set, redirecting to", target);
      window.location.replace(target);
    } else {
      console.log("[Login] No PIN set, transitioning to set_pin step");
      setStep("set_pin");
      setLoading(false);
    }
  };

  // ── Role Selection (new user or multi-role existing) ──
  const handleRoleSelect = async (role: "merchant" | "customer") => {
    setLoading(true);
    setError("");

    if (selectRoleMode === "register") {
      // New user — create account with chosen role
      console.log("[Login] Creating new", role, "account for phone:", phone);
      const regResult = await registerNewUser(phone, role);
      console.log("[Login] registerNewUser result:", JSON.stringify(regResult));
      if (!regResult.success) {
        setError(regResult.error || "Failed to create account");
        setLoading(false);
        return;
      }

      // Wipe previous state before setting new
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

      if (regResult.userId) {
        localStorage.setItem("merchant_id", regResult.userId);
      }
      if (regResult.phone) {
        localStorage.setItem("merchant_phone", regResult.phone);
      }

      userInfoRef.current = { userId: regResult.userId!, userType: role };
      console.log("[Login] New user created, proceeding to PIN setup");
      setStep("set_pin");
      setLoading(false);
      return;
    }

    // Existing multi-role user — login with chosen role
    console.log("[Login] Logging in as", role, "for user:", userInfoRef.current?.userId);
    if (!userInfoRef.current?.userId) {
      setError("Session expired. Please re-enter your phone.");
      setStep("phone");
      return;
    }

    const selectedInfo = { userId: userInfoRef.current.userId, userType: role };
    userInfoRef.current = selectedInfo;

    // Check if this role has a PIN set
    const checkResult = await checkUserExists(phone);
    const userForRole = checkResult.users.find((u) => u.userType === role || u.userType === "both");
    const hasPin = userForRole?.hasPin ?? false;

    if (hasPin) {
      console.log("[Login] Multi-role user has PIN → showing PIN entry");
      setStep("pin");
    } else {
      console.log("[Login] Multi-role user has no PIN → set_pin");
      setStep("set_pin");
    }
    setLoading(false);
  };

  // ── Forgot PIN ──
  const handleForgotPhoneSubmit = async () => {
    if (!phone || phone.length < 10) return;
    setLoading(true);
    setError("");
    console.log("[Login] Forgot PIN: sending OTP to", phone);
    const result = await forgotPinSendOtp(phone);
    console.log("[Login] Forgot PIN OTP result:", JSON.stringify(result));
    if (!result.success) {
      setError(result.error || "Failed to send OTP");
      setLoading(false);
      return;
    }
    setStep("forgot_otp");
    setLoading(false);
  };

  const handleForgotOtpSubmit = async () => {
    if (otp.length < 4) return;
    const newPinStr = pinArrayToString(newPin);
    if (newPinStr.length < 4) { setError("Enter a new 4-digit PIN"); return; }
    const confirmStr = pinArrayToString(confirmPin);
    if (newPinStr !== confirmStr) { setError("PINs do not match"); return; }
    setLoading(true);
    setError("");
    console.log("[Login] Forgot PIN: verifying OTP and resetting PIN");
    const result = await forgotPinVerifyOtp(phone, otp, newPinStr);
    console.log("[Login] Forgot PIN result:", JSON.stringify(result));
    if (!result.success) {
      setError(result.error || "Verification failed");
      setLoading(false);
      return;
    }
    console.log("[Login] PIN reset, redirecting to", result.redirect);
    window.location.replace(result.redirect || "/merchant/dashboard");
  };

  const backToPhone = () => { setStep("phone"); setError(""); };

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
            ) : "Unlock"}
          </button>

          <button
            onClick={() => { setStep("forgot_phone"); setError(""); }}
            className="w-full text-center text-sm text-[var(--color-text-muted)] active:text-[var(--color-primary)] transition-colors"
          >
            Forgot PIN?
          </button>
        </div>
      )}

      {/* ── Set PIN (legacy user or after OTP) ── */}
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
            ) : "Set PIN & Continue"}
          </button>

          <button onClick={handleSkipPin} className="w-full text-center text-sm text-[var(--color-text-muted)] active:text-[var(--color-primary)] transition-colors">
            Skip for now
          </button>
        </div>
      )}

      {/* ── Role Selection — new user or multi-role existing ── */}
      {step === "select_role" && (
        <div className="w-full max-w-xs space-y-6 animate-fade-in">
          <p className="text-sm text-[var(--color-text-muted)] text-center">
            {selectRoleMode === "register"
              ? "Register as"
              : "Login as"}
          </p>

          <div className="space-y-3">
            {availableRoles.includes("merchant") && (
              <button
                onClick={() => handleRoleSelect("merchant")}
                disabled={loading}
                className="w-full p-4 bg-white rounded-xl border border-gray-200 hover:border-[var(--color-primary)] active:scale-[0.98] transition-all flex items-center gap-4"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="font-semibold text-[var(--color-text)]">Merchant</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Manage your shop, credits & customers</p>
                </div>
              </button>
            )}

            {availableRoles.includes("customer") && (
              <button
                onClick={() => handleRoleSelect("customer")}
                disabled={loading}
                className="w-full p-4 bg-white rounded-xl border border-gray-200 hover:border-[var(--color-primary)] active:scale-[0.98] transition-all flex items-center gap-4"
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="font-semibold text-[var(--color-text)]">Customer</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Track your purchases & credit history</p>
                </div>
              </button>
            )}
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-xl text-center">{error}</div>
          )}

          {loading && (
            <div className="flex justify-center">
              <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}

      {/* ── Phone Entry ── */}
      {step === "phone" && (
        <div className="w-full max-w-xs space-y-4 animate-fade-in">
          <p className="text-sm text-[var(--color-text-muted)] text-center">Sign in with your phone number</p>

          <div>
            <label className="text-sm font-medium text-[var(--color-text)]">Phone Number</label>
            <div className="flex mt-1">
              <span className="px-3 py-3 bg-gray-100 rounded-l-xl text-sm font-medium text-gray-500 border border-r-0 border-gray-100">+977</span>
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
            ) : "Continue"}
          </button>
        </div>
      )}

      {/* ── OTP Verify (new user) ── */}
      {step === "otp" && (
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
            ) : "Verify & Login"}
          </button>

          <button onClick={backToPhone} className="w-full text-center text-sm text-[var(--color-text-muted)] active:text-[var(--color-primary)] transition-colors">
            Change phone number
          </button>
        </div>
      )}

      {/* ── Forgot PIN ── */}
      {step === "forgot_phone" && (
        <div className="w-full max-w-xs space-y-4 animate-fade-in">
          <p className="text-sm text-[var(--color-text-muted)] text-center">Enter your registered phone to reset PIN</p>

          <div>
            <label className="text-sm font-medium text-[var(--color-text)]">Phone Number</label>
            <div className="flex mt-1">
              <span className="px-3 py-3 bg-gray-100 rounded-l-xl text-sm font-medium text-gray-500 border border-r-0 border-gray-100">+977</span>
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
            onClick={handleForgotPhoneSubmit}
            disabled={phone.length < 10 || loading}
            className="w-full py-3.5 bg-[var(--color-primary)] text-white rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : "Send Reset OTP"}
          </button>

          <button onClick={() => { setStep("pin"); setError(""); }} className="w-full text-center text-sm text-[var(--color-text-muted)] active:text-[var(--color-primary)] transition-colors">
            Back to PIN entry
          </button>
        </div>
      )}

      {step === "forgot_otp" && (
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

          <div className="space-y-4 pt-2 border-t border-gray-100">
            <p className="text-xs text-[var(--color-text-muted)] text-center">Set a new 4-digit PIN</p>
            {renderPinDots(newPin, setNewPin, newPinRefs, "New PIN")}
            {renderPinDots(confirmPin, setConfirmPin, confirmPinRefs, "Confirm PIN")}
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-xl">{error}</div>
          )}

          <button
            onClick={handleForgotOtpSubmit}
            disabled={otp.length < 4 || pinArrayToString(newPin).length < 4 || pinArrayToString(confirmPin).length < 4 || loading}
            className="w-full py-3.5 bg-[var(--color-primary)] text-white rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : "Verify & Reset PIN"}
          </button>

          <button onClick={() => { setStep("forgot_phone"); setError(""); }} className="w-full text-center text-sm text-[var(--color-text-muted)] active:text-[var(--color-primary)] transition-colors">
            Back
          </button>
        </div>
      )}
    </div>
  );
}
