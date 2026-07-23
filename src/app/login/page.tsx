"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { sendRegistrationOtp, verifyRegistrationOtp } from "@/app/actions/otp";
import { checkUserExists, verifyPin, setPin as setMerchantPin, loginWithPin, forgotPinSendOtp, forgotPinVerifyOtp, registerNewUser } from "@/app/actions/pin";
import LogoWithAbout from "@/components/LogoWithAbout";

type Step =
  | "loading"
  | "welcome"
  | "phone"
  | "pin"
  | "set_pin"
  | "otp"
  | "select_role"
  | "forgot_phone"
  | "forgot_otp"
  | "post_signout_role";

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
  const userInfoRef = useRef<{ userId: string; userType: "merchant" | "customer" | "both"; name?: string } | null>(null);
  const [selectRoleMode, setSelectRoleMode] = useState<SelectRoleMode>("register");
  const [availableRoles, setAvailableRoles] = useState<("merchant" | "customer")[]>(["merchant", "customer"]);
  const [registerName, setRegisterName] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "register" | null>(null);
  const [phoneErrorAction, setPhoneErrorAction] = useState<"signin" | "register" | null>(null);
  const [addRoleTarget, setAddRoleTarget] = useState<"merchant" | "customer" | null>(null);
  const mountedRef = useRef(true);



  const focusPinInput = useCallback((refs: React.MutableRefObject<(HTMLInputElement | null)[]>, idx: number) => {
    if (idx >= 0 && idx < 4) refs.current[idx]?.focus();
  }, []);

  const handlePinDigit = (
    value: string,
    idx: number,
    pinArr: string[],
    setter: (v: string[]) => void,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>,
    autoSubmit?: () => void,
  ) => {
    if (!/^\d*$/.test(value)) return;
    const digit = value.slice(-1);
    const next = [...pinArr];
    next[idx] = digit;
    setter(next);
    if (digit && idx < 3) {
      focusPinInput(refs, idx + 1);
    } else if (digit && idx === 3) {
      // All 4 digits entered — auto-submit after a brief delay for visual feedback
      if (autoSubmit) {
        setTimeout(() => autoSubmit(), 150);
      }
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

  // ── Silent session check on mount ──
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted && mountedRef.current) {
        setLoading(false);
      }
    };
    window.addEventListener("pageshow", handlePageShow);

    (async () => {
      if (typeof window === "undefined") return;

      // 1. Check for last signed-out session (quick re-login for dual-role)
      const lastSessionRaw = localStorage.getItem("qr_hisab_last_session");
      if (lastSessionRaw) {
        try {
          const { phone: lastPhone, isDualRole } = JSON.parse(lastSessionRaw);
          localStorage.removeItem("qr_hisab_last_session");
          window.history.replaceState({}, "", window.location.pathname);
          if (!cancelled) {
            if (isDualRole) {
              setStep("post_signout_role");
            } else {
              setPhone(lastPhone);
              setStep("phone");
            }
          }
        } catch {
          localStorage.removeItem("qr_hisab_last_session");
          if (!cancelled) setStep("welcome");
        }
        return;
      }

      // 2. Skip session check if user just signed out — show welcome modal
      if (new URLSearchParams(window.location.search).has("signedOut")) {
        window.history.replaceState({}, "", window.location.pathname);
        if (!cancelled) setStep("welcome");
        return;
      }

      // 2b. Add-role flow: user is already logged in and wants to register the other role
      const addRoleParam = new URLSearchParams(window.location.search).get("addRole");
      if (addRoleParam === "merchant" || addRoleParam === "customer") {
        window.history.replaceState({}, "", window.location.pathname);
        setAddRoleTarget(addRoleParam);
        const merchantPhone = localStorage.getItem("merchant_phone");
        if (merchantPhone) setPhone(merchantPhone);
        if (!cancelled) { setStep("phone"); setLoading(false); }
        return;
      }

      // 3. Also skip session check if user has no local session data
      // (means they explicitly navigated to /login, not redirected from middleware)
      const hasLocalSession = localStorage.getItem("merchant_id") || localStorage.getItem("sajilo_customer_session");
      if (!hasLocalSession) {
        console.log("[Login] No local session data → showing welcome");
        if (!cancelled) setStep("welcome");
        return;
      }

      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        const data: { 
          userId: string | null; 
          roles: string[]; 
          merchantPhone?: string; 
          merchantName?: string; 
          customerPhone?: string; 
          customerName?: string; 
        } = await res.json();
        console.log("[Login] Mount session check:", JSON.stringify(data));
        if (cancelled) return;
        if (data.userId) {
          // Re-establish client-side state so dashboards don't bounce the user back
          if (data.merchantPhone) {
            localStorage.setItem("merchant_id", data.userId);
            localStorage.setItem("merchant_phone", data.merchantPhone);
          }
          if (data.customerPhone) {
            localStorage.setItem("sajilo_customer_session", JSON.stringify({ phone: data.customerPhone, name: data.customerName || "" }));
            document.cookie = `customer_session=${encodeURIComponent(JSON.stringify({ phone: data.customerPhone, name: data.customerName || "" }))}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`;
          }

          if (data.roles.length === 0) {
            console.log("[Login] Session exists but no roles → showing welcome");
            if (!cancelled) setStep("welcome");
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
      if (!cancelled) setStep("welcome");
    })();
    return () => {
      cancelled = true;
      mountedRef.current = false;
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  // ── Phone Submit ──
  const handlePhoneSubmit = async () => {
    const digitsOnly = phone.replace(/\D/g, "");
    if (digitsOnly.length < 10) return;
    setLoading(true);
    setError("");

    const cleanPhone = digitsOnly.slice(-10);
    console.log("[Login] Phone submit, checking existence for:", cleanPhone);
    let exists = false;
    let users: Awaited<ReturnType<typeof checkUserExists>>["users"] = [];
    try {
      const result = await checkUserExists(cleanPhone);
      if (!mountedRef.current) return;
      exists = result.exists;
      users = result.users;
      console.log("[Login] checkUserExists result:", { exists, users });
    } catch (e: any) {
      if (!mountedRef.current) return;
      const errorDetail = {
        name: e?.name,
        message: e?.message,
        stack: e?.stack?.split('\n').slice(0, 5).join('\n'),
        cause: e?.cause,
        type: typeof e,
        isTypeError: e instanceof TypeError,
        isAbortError: e instanceof DOMException && e.name === 'AbortError',
        isNetworkError: e?.message?.includes('Failed to fetch') || e?.message?.includes('NetworkError'),
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        online: navigator.onLine,
        serviceWorkerReady: 'serviceWorker' in navigator,
      };
      console.error("[Login] Phone submit error:", JSON.stringify(errorDetail, null, 2));
      console.error("[Login] Original error object:", e);
      setError(e?.message || "Network error. Please try again.");
      setLoading(false);
      return;
    }

    // Auth mode validation
    if (authMode === "register" && exists) {
      setError("This phone number is already registered.");
      setPhoneErrorAction("signin");
      setLoading(false);
      return;
    }
    if (authMode === "signin" && !exists) {
      setError("No account found with this number.");
      setPhoneErrorAction("register");
      setLoading(false);
      return;
    }

    // Add-role flow: always send OTP regardless of whether user exists in one table
    if (addRoleTarget) {
      try {
        const otpResult = await sendRegistrationOtp(cleanPhone);
        if (!mountedRef.current) return;
        if (!otpResult.success) {
          setError(otpResult.error || "Failed to send OTP");
          setLoading(false);
          return;
        }
      } catch (e) {
        if (!mountedRef.current) return;
        console.error("[Login] Add-role OTP send error:", e);
        setError((e as Error)?.message || "Network error. Please try again.");
        setLoading(false);
        return;
      }
      setStep("otp");
      setLoading(false);
      return;
    }

    if (!exists) {
      console.log("[Login] New user → sending OTP");
      try {
        const otpResult = await sendRegistrationOtp(cleanPhone);
        if (!mountedRef.current) return;
        if (!otpResult.success) {
          console.log("[Login] OTP send failed:", otpResult.error);
          setError(otpResult.error || "Failed to send OTP");
          setLoading(false);
          return;
        }
      } catch (e) {
        if (!mountedRef.current) return;
        console.error("[Login] OTP send error:", e);
        setError((e as Error)?.message || "Network error. Please try again.");
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
      userInfoRef.current = { userId: users[0].userId, userType: users[0].userType, name: users[0].name };
      setAvailableRoles(["merchant", "customer"]);
      setSelectRoleMode("login");
      setStep("select_role");
      setLoading(false);
      return;
    }

    const user = users[0];
    userInfoRef.current = { userId: user.userId, userType: user.userType, name: user.name };
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

    try {
      console.log("[Login] Verifying PIN for user:", info.userId);
      const result = await loginWithPin(info.userId, pinStr, info.userType);
      console.log("[Login] loginWithPin result:", JSON.stringify(result));
      if (!result.success) {
        if (!mountedRef.current) return;
        setError(result.error || "Incorrect PIN");
        setPin(["", "", "", ""]);
        focusPinInput(pinRefs, 0);
        setLoading(false);
        return;
      }

      localStorage.setItem("merchant_id", info.userId);
      if (phone) {
        localStorage.setItem("merchant_phone", phone);
        if (info.userType === "customer") {
          localStorage.setItem("sajilo_customer_session", JSON.stringify({ phone, name: info.name || "" }));
          document.cookie = `customer_session=${encodeURIComponent(JSON.stringify({ phone, name: info.name || "" }))}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`;
        }
        // Mark PIN as unlocked so CustomerPinGate skips re-prompt on dashboard
        if (info.userType === "customer" || info.userType === "both") {
          localStorage.setItem("qr_hisab_auth_" + phone, String(Date.now()));
        }
      }

      console.log("[Login] PIN verified, redirecting to", result.redirect);
      window.location.assign(result.redirect || "/merchant/dashboard");
    } catch (e) {
      if (!mountedRef.current) return;
      console.error("[Login] PIN submit error:", e);
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
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

    try {
      console.log("[Login] Setting PIN for user:", info.userId, "type:", info.userType);
      const result = await setMerchantPin(info.userId, newPinStr);
      console.log("[Login] setPin result:", JSON.stringify(result));
      if (!result.success) {
        if (!mountedRef.current) return;
        setError(result.error || "Failed to set PIN");
        setLoading(false);
        return;
      }

      localStorage.setItem("merchant_id", info.userId);
      if (phone) {
        localStorage.setItem("merchant_phone", phone);
        if (info.userType === "customer") {
          localStorage.setItem("sajilo_customer_session", JSON.stringify({ phone, name: info.name || "" }));
          document.cookie = `customer_session=${encodeURIComponent(JSON.stringify({ phone, name: info.name || "" }))}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`;
        }
        // Mark PIN as unlocked so CustomerPinGate skips re-prompt on dashboard
        if (info.userType === "customer" || info.userType === "both") {
          localStorage.setItem("qr_hisab_auth_" + phone, String(Date.now()));
        }
      }

      const target = info.userType === "customer" ? "/customer/dashboard" : "/merchant/dashboard";
      console.log("[Login] PIN set successfully, redirecting to", target);
      window.location.assign(target);
    } catch (e) {
      if (!mountedRef.current) return;
      console.error("[Login] Set PIN error:", e);
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const handleSkipPin = () => {
    const info = userInfoRef.current;
    if (info?.userId) {
      localStorage.setItem("merchant_id", info.userId);
      if (phone) {
        localStorage.setItem("merchant_phone", phone);
        if (info.userType === "customer") {
          localStorage.setItem("sajilo_customer_session", JSON.stringify({ phone, name: info.name || "" }));
          document.cookie = `customer_session=${encodeURIComponent(JSON.stringify({ phone, name: info.name || "" }))}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`;
        }
        // Mark as unlocked so CustomerPinGate shows dashboard directly
        // (user can set PIN later in profile settings)
        if (info.userType === "customer" || info.userType === "both") {
          localStorage.setItem("qr_hisab_auth_" + phone, String(Date.now()));
        }
      }
    }
    const target = info?.userType === "customer" ? "/customer/dashboard"
      : info?.userType === "merchant" ? "/merchant/dashboard"
      : info?.userType === "both" ? "/select-role"
      : "/merchant/dashboard";
    console.log("[Login] Skipping PIN, redirecting to", target);
    window.location.assign(target);
  };

  // ── OTP Verify (new user registration) ──
  const handleOtpSubmit = async () => {
    if (otp.length < 4) return;
    setLoading(true);
    setError("");

    try {
      console.log("[Login] Verifying OTP for phone:", phone);
      const result = await verifyRegistrationOtp(phone, otp);
      console.log("[Login] verifyRegistrationOtp result:", JSON.stringify(result));
      if (!result.success) {
        if (!mountedRef.current) return;
        setError(result.error || "Invalid OTP");
        setLoading(false);
        return;
      }

      // Add-role flow: user verified their phone, now create the missing role
      if (addRoleTarget) {
        if (!mountedRef.current) return;

        // Guard: user already has this role
        if (result.userType === addRoleTarget || result.userType === "both") {
          setError("You already have this role.");
          setLoading(false);
          return;
        }

        const regResult = await registerNewUser(phone, addRoleTarget, registerName.trim() || undefined);
        if (!regResult.success) {
          if (!mountedRef.current) return;
          setError(regResult.error || "Failed to create account");
          setLoading(false);
          return;
        }

        // Preserve existing session data — do NOT wipe localStorage
        if (regResult.userId) {
          localStorage.setItem("merchant_id", regResult.userId);
        }
        if (regResult.phone) {
          localStorage.setItem("merchant_phone", regResult.phone);
          if (addRoleTarget === "customer") {
            localStorage.setItem("sajilo_customer_session", JSON.stringify({ phone: regResult.phone, name: registerName.trim() || "" }));
            document.cookie = `customer_session=${encodeURIComponent(JSON.stringify({ phone: regResult.phone, name: registerName.trim() || "" }))}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`;
          }
        }
        userInfoRef.current = { userId: regResult.userId!, userType: addRoleTarget, name: registerName.trim() || "" };
        console.log("[Login] Add-role: created", addRoleTarget, "account, proceeding to PIN setup");
        setStep("set_pin");
        setLoading(false);
        return;
      }

      if (!result.exists) {
        // New user — need role selection before creating account
        console.log("[Login] New user, no existing account → role selection");
        if (!mountedRef.current) return;
        setSelectRoleMode("register");
        setAvailableRoles(["merchant", "customer"]);
        // Store phone in userInfoRef for use after role selection
        userInfoRef.current = null;
        setStep("select_role");
        setLoading(false);
        return;
      }

      // Existing user
      // Wipe previous state safely (preserve app config and customer session)
      const swVersion = localStorage.getItem("sw_version");
      const pwaDismissed = localStorage.getItem("pwa-install-dismissed");
      const savedCustomerSession = localStorage.getItem("sajilo_customer_session");
      
      localStorage.clear();
      sessionStorage.clear();
      
      if (swVersion) localStorage.setItem("sw_version", swVersion);
      if (pwaDismissed) localStorage.setItem("pwa-install-dismissed", pwaDismissed);
      if (savedCustomerSession) localStorage.setItem("sajilo_customer_session", savedCustomerSession);
      
      try {
        const { clearIndexedDB } = await import("@/lib/offline/db");
        await clearIndexedDB();
      } catch { /* ignore */ }
      
      document.cookie.split(";").forEach((c) => {
        const name = c.trim().split("=")[0];
        if (name !== "customer_session") {
          document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; max-age=0`;
        }
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
      userInfoRef.current = { userId: result.userId!, userType, name: result.name };
      console.log("[Login] OTP verified for existing user:", userInfoRef.current);

      // Check if PIN already set
      const hasPin = result.hasPin;
      console.log("[Login] PIN check after OTP:", { hasPin, userType });
      if (!mountedRef.current) return;
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
        window.location.assign(target);
      } else {
        console.log("[Login] No PIN set, transitioning to set_pin step");
        setStep("set_pin");
        setLoading(false);
      }
    } catch (e) {
      if (!mountedRef.current) return;
      console.error("[Login] OTP submit error:", e);
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  // ── Role Selection (new user or multi-role existing) ──
  const handleRoleSelect = async (role: "merchant" | "customer") => {
    setLoading(true);
    setError("");

    if (selectRoleMode === "register") {
      // New user — create account with chosen role
      const shopName = registerName.trim() || undefined;
      console.log("[Login] Creating new", role, "account for phone:", phone, "name:", shopName);
      const regResult = await registerNewUser(phone, role, shopName);
      if (!mountedRef.current) return;
      console.log("[Login] registerNewUser result:", JSON.stringify(regResult));
      if (!regResult.success) {
        setError(regResult.error || "Failed to create account");
        setLoading(false);
        return;
      }

      // Wipe previous state safely before setting new
      const swVersion = localStorage.getItem("sw_version");
      const pwaDismissed = localStorage.getItem("pwa-install-dismissed");
      const savedCustomerSession = localStorage.getItem("sajilo_customer_session");

      localStorage.clear();
      sessionStorage.clear();

      if (swVersion) localStorage.setItem("sw_version", swVersion);
      if (pwaDismissed) localStorage.setItem("pwa-install-dismissed", pwaDismissed);
      if (savedCustomerSession) localStorage.setItem("sajilo_customer_session", savedCustomerSession);

      try {
        const { clearIndexedDB } = await import("@/lib/offline/db");
        await clearIndexedDB();
      } catch { /* ignore */ }

      document.cookie.split(";").forEach((c) => {
        const name = c.trim().split("=")[0];
        if (name !== "customer_session") {
          document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC; max-age=0`;
        }
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
        if (role === "customer") {
          localStorage.setItem("sajilo_customer_session", JSON.stringify({ phone: regResult.phone, name: registerName.trim() }));
          document.cookie = `customer_session=${encodeURIComponent(JSON.stringify({ phone: regResult.phone, name: registerName.trim() }))}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`;
        }
      }

      userInfoRef.current = { userId: regResult.userId!, userType: role, name: registerName.trim() };
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
    if (!mountedRef.current) return;
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

  // ── Post sign-out role selection ──
  const handlePostSignoutRoleSelect = async (role: "merchant" | "customer") => {
    setLoading(true);
    setError("");
    try {
      const raw = localStorage.getItem("qr_hisab_last_session");
      if (!raw) {
        setStep("phone");
        setLoading(false);
        return;
      }
      const { phone: lastPhone } = JSON.parse(raw);
      localStorage.removeItem("qr_hisab_last_session");
      setPhone(lastPhone);
      const result = await checkUserExists(lastPhone);
      if (!mountedRef.current) return;
      const user = result.users.find((u) => u.userType === role || u.userType === "both");
      if (!user) {
        setError("Account not found. Please sign in again.");
        setStep("phone");
        setLoading(false);
        return;
      }
      userInfoRef.current = { userId: user.userId, userType: role, name: user.name };
      if (user.hasPin) {
        setStep("pin");
      } else {
        setStep("set_pin");
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setStep("phone");
    }
    setLoading(false);
  };

  const handlePhoneErrorAction = () => {
    if (phoneErrorAction) {
      setAuthMode(phoneErrorAction);
      setError("");
      setPhoneErrorAction(null);
    }
  };

  // ── Forgot PIN ──
  const handleForgotPhoneSubmit = async () => {
    if (!phone || phone.length < 10) return;
    setLoading(true);
    setError("");
    try {
      console.log("[Login] Forgot PIN: sending OTP to", phone);
      const result = await forgotPinSendOtp(phone);
      if (!mountedRef.current) return;
      console.log("[Login] Forgot PIN OTP result:", JSON.stringify(result));
      if (!result.success) {
        setError(result.error || "Failed to send OTP");
        setLoading(false);
        return;
      }
      setStep("forgot_otp");
    } catch (e) {
      console.error("[Login] Forgot PIN submit error:", e);
      setError((e as Error)?.message || "Network error. Please try again.");
    }
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
    try {
      console.log("[Login] Forgot PIN: verifying OTP and resetting PIN");
      const result = await forgotPinVerifyOtp(phone, otp, newPinStr);
      console.log("[Login] Forgot PIN result:", JSON.stringify(result));
      if (!result.success) {
        if (!mountedRef.current) return;
        setError(result.error || "Verification failed");
        setLoading(false);
        return;
      }
      if (result.userId) localStorage.setItem("merchant_id", result.userId);
      const forgotType = result.redirect?.includes("merchant") ? "merchant" : result.redirect?.includes("customer") ? "customer" : undefined;
      if (phone) {
        localStorage.setItem("merchant_phone", phone);
        if (forgotType === "customer") {
          localStorage.setItem("sajilo_customer_session", JSON.stringify({ phone, name: "" }));
          document.cookie = `customer_session=${encodeURIComponent(JSON.stringify({ phone, name: "" }))}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`;
        }
        // Mark PIN as unlocked so CustomerPinGate skips re-prompt on dashboard
        if (forgotType === "customer") {
          localStorage.setItem("qr_hisab_auth_" + phone, String(Date.now()));
        }
      }
      console.log("[Login] PIN reset, redirecting to", result.redirect);
      window.location.assign(result.redirect || "/merchant/dashboard");
    } catch (e) {
      if (!mountedRef.current) return;
      console.error("[Login] Forgot PIN verify error:", e);
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const backToPhone = () => { setStep("phone"); setError(""); };

  if (step === "loading") {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 py-12 bg-[var(--color-bg)]">
        <div role="status" aria-live="polite" className="w-12 h-12 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-sm text-[var(--color-text-muted)]">Checking session...</p>
      </div>
    );
  }

  const renderPinDots = (
    pinArr: string[],
    setter: (v: string[]) => void,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>,
    label: string,
    autoSubmit?: () => void,
  ) => (
    <div>
      <label className="block text-sm font-medium text-[var(--color-text)] mb-3 text-center">{label}</label>
      <div className="flex justify-center gap-2">
        {pinArr.map((d, i) => (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={d}
            onChange={(e) => handlePinDigit(e.target.value, i, pinArr, setter, refs, autoSubmit)}
            onKeyDown={(e) => handlePinKeyDown(e, i, pinArr, setter, refs)}
            onFocus={(e) => e.target.select()}
            className="w-14 h-14 text-center text-2xl font-bold bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 py-12 bg-[var(--color-bg)]">
      <div className="mb-8 text-center animate-fade-in">
        <div className="mx-auto mb-4">
          <LogoWithAbout size={64} showAnimation />
        </div>
        <h1 className="text-2xl font-extrabold text-[var(--color-text)]">Welcome! 👋</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">Your digital khata awaits</p>
        {(step === "pin" || step === "set_pin") && userInfoRef.current?.userType && (
          <div className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
            userInfoRef.current.userType === "merchant" || userInfoRef.current.userType === "both"
              ? "bg-blue-100 text-blue-700"
              : "bg-[var(--color-primary)]/10 text-[var(--color-primary-dark)]"
          }`}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {userInfoRef.current.userType === "customer" ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
              )}
            </svg>
            <span>
              {userInfoRef.current.userType === "both" ? "Merchant & Customer"
                : userInfoRef.current.userType === "merchant" ? "Merchant"
                : "Customer"}
            </span>
          </div>
        )}
      </div>

      {/* ── PIN Entry ── */}
      {step === "pin" && (
        <div className="w-full max-w-xs space-y-6 animate-fade-in">
          {renderPinDots(pin, setPin, pinRefs, "Enter your PIN", handlePinSubmit)}

          {error && (
            <div role="alert" className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-4 py-2 rounded-xl text-center">{error}</div>
          )}

          <button
            onClick={handlePinSubmit}
            disabled={pinArrayToString(pin).length < 4 || loading}
            className="w-full py-3.5 bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : "Unlock"}
          </button>

          <button
            onClick={() => { setStep("forgot_phone"); setError(""); }}
            className="w-full text-center text-sm text-[var(--color-text-muted)] active:text-[var(--color-primary)] transition-colors py-3"
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
            <div role="alert" className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-4 py-2 rounded-xl text-center">{error}</div>
          )}

          <button
            onClick={handleSetPin}
            disabled={pinArrayToString(newPin).length < 4 || pinArrayToString(confirmPin).length < 4 || loading}
            className="w-full py-3.5 bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : "Set PIN & Continue"}
          </button>

          <button onClick={handleSkipPin} className="w-full text-center text-sm text-[var(--color-text-muted)] active:text-[var(--color-primary)] transition-colors py-3">
            Skip for now
          </button>
        </div>
      )}

      {/* ── Role Selection — new user or multi-role existing ── */}
      {step === "select_role" && (
        <div className="w-full max-w-xs space-y-6 animate-fade-in">
          {selectRoleMode === "register" && (
            <div>
              <label className="text-sm font-medium text-[var(--color-text)]">Full Name or Shop Name *</label>
              <input
                type="text"
                value={registerName}
                onChange={(e) => setRegisterName(e.target.value)}
                placeholder="e.g. Giri Kirana Store"
                maxLength={100}
                className="w-full mt-1 px-4 py-3 bg-[var(--color-surface)] rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
                autoFocus
              />
            </div>
          )}
          <p className="text-sm text-[var(--color-text-muted)] text-center">
            {selectRoleMode === "register"
              ? "Register as"
              : "Login as"}
          </p>

          <div className="space-y-3">
            {availableRoles.includes("merchant") && (
              <button
                onClick={() => handleRoleSelect("merchant")}
                disabled={loading || (selectRoleMode === "register" && !registerName.trim())}
                className="w-full p-4 bg-[var(--color-surface)] rounded-xl border border-gray-200 dark:border-gray-600 hover:border-[var(--color-primary)] active:scale-[0.98] transition-all flex items-center gap-4 disabled:opacity-50"
              >
                <div className="w-12 h-12 rounded-xl bg-[var(--color-primary)]/5 flex items-center justify-center">
                  <svg className="w-6 h-6 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                className="w-full p-4 bg-[var(--color-surface)] rounded-xl border border-gray-200 dark:border-gray-600 hover:border-[var(--color-primary)] active:scale-[0.98] transition-all flex items-center gap-4"
              >
                <div className="w-12 h-12 rounded-xl bg-[var(--color-primary)]/5 flex items-center justify-center">
                  <svg className="w-6 h-6 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
            <div role="alert" className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-4 py-2 rounded-xl text-center">{error}</div>
          )}

          {loading && (
            <div className="flex justify-center">
              <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}

      {/* ── Welcome Modal ── */}
      {step === "welcome" && (
        <div className="w-full max-w-xs space-y-4 animate-fade-in">
          <p className="text-sm text-[var(--color-text-muted)] text-center">How would you like to continue?</p>

          <button
            onClick={() => { setAuthMode("signin"); setStep("phone"); setError(""); setPhoneErrorAction(null); }}
            className="w-full py-3.5 bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] rounded-xl font-semibold active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            Sign In to Existing Account
          </button>

          <button
            onClick={() => { setAuthMode("register"); setStep("phone"); setError(""); setPhoneErrorAction(null); }}
            className="w-full py-3.5 bg-[var(--color-surface)] text-[var(--color-text)] rounded-xl font-semibold border border-gray-200 dark:border-gray-600 hover:border-[var(--color-primary)] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
            </svg>
            Create a New Account
          </button>
        </div>
      )}

      {/* ── Post Sign-out Role Selection ── */}
      {step === "post_signout_role" && (
        <div className="w-full max-w-xs space-y-4 animate-fade-in">
          <p className="text-sm text-[var(--color-text-muted)] text-center">Choose which account to continue with</p>

          <button
            onClick={() => handlePostSignoutRoleSelect("merchant")}
            disabled={loading}
            className="w-full p-4 bg-[var(--color-surface)] rounded-xl border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600 active:scale-[0.98] transition-all flex items-center gap-4 disabled:opacity-50"
          >
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div className="text-left">
              <p className="font-semibold text-[var(--color-text)]">Continue as Merchant</p>
              <p className="text-xs text-[var(--color-text-muted)]">Manage your shop, credits & customers</p>
            </div>
          </button>

          <button
            onClick={() => handlePostSignoutRoleSelect("customer")}
            disabled={loading}
            className="w-full p-4 bg-[var(--color-surface)] rounded-xl border border-gray-200 dark:border-gray-600 hover:border-[var(--color-primary-light)] active:scale-[0.98] transition-all flex items-center gap-4 disabled:opacity-50"
          >
            <div className="w-12 h-12 rounded-xl bg-[var(--color-primary)]/5 flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
              </svg>
            </div>
            <div className="text-left">
              <p className="font-semibold text-[var(--color-text)]">Continue as Customer</p>
              <p className="text-xs text-[var(--color-text-muted)]">Track your purchases & credit history</p>
            </div>
          </button>

          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-gray-700" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-3 bg-[var(--color-bg)] text-[var(--color-text-muted)]">or</span>
            </div>
          </div>

          <button
            onClick={() => {
              localStorage.removeItem("qr_hisab_last_session");
              setPhone("");
              setStep("phone");
              setError("");
            }}
            disabled={loading}
            className="w-full text-center text-sm text-[var(--color-text-muted)] active:text-[var(--color-primary)] transition-colors py-3"
          >
            Use another account
          </button>

          {error && (
            <div role="alert" className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-4 py-2 rounded-xl text-center">{error}</div>
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
          <p className="text-sm text-[var(--color-text-muted)] text-center">
            {authMode === "register" ? "Enter your phone number to create an account" : "Sign in with your phone number"}
          </p>

          <div>
            <label className="text-sm font-medium text-[var(--color-text)]">Phone Number</label>
            <div className="flex mt-1">
              <span className="px-3 py-3 bg-gray-100 dark:bg-gray-800 rounded-l-xl text-sm font-medium text-gray-500 dark:text-gray-400 border border-r-0 border-gray-100 dark:border-gray-700">+977</span>
              <input
                type="tel"
                placeholder="9841234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                className="flex-1 px-4 py-3 bg-[var(--color-surface)] rounded-r-xl text-lg font-mono border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none"
                maxLength={10}
              />
            </div>
          </div>

          {error && (
            <div role="alert" className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-4 py-2 rounded-xl text-center">{error}</div>
          )}
          {phoneErrorAction && (
            <button
              onClick={handlePhoneErrorAction}
              className="w-full py-2.5 text-sm font-medium text-[var(--color-primary)] bg-[var(--color-primary)]/5 rounded-xl active:scale-[0.98] transition-transform"
            >
              {phoneErrorAction === "signin" ? "Sign In Instead" : "Create a New Account"}
            </button>
          )}

          <button
            onClick={handlePhoneSubmit}
            disabled={phone.length < 10 || loading}
            className="w-full py-3.5 bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : "Continue"}
          </button>

          {authMode && (
            <button
              onClick={() => { setStep("welcome"); setError(""); setPhoneErrorAction(null); setAuthMode(null); }}
              className="w-full text-center text-sm text-[var(--color-text-muted)] active:text-[var(--color-primary)] transition-colors"
            >
              ← Back
            </button>
          )}
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
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
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
              className="w-full mt-1 px-4 py-3 bg-[var(--color-surface)] rounded-xl text-2xl font-mono text-center border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none tracking-widest"
              maxLength={6}
            />
          </div>

          {error && (
            <div role="alert" className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-4 py-2 rounded-xl">{error}</div>
          )}

          <button
            onClick={handleOtpSubmit}
            disabled={otp.length < 4 || loading}
            className="w-full py-3.5 bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : "Verify & Login"}
          </button>

          <button onClick={backToPhone} className="w-full text-center text-sm text-[var(--color-text-muted)] active:text-[var(--color-primary)] transition-colors py-3">
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
              <span className="px-3 py-3 bg-gray-100 dark:bg-gray-800 rounded-l-xl text-sm font-medium text-gray-500 dark:text-gray-400 border border-r-0 border-gray-100 dark:border-gray-700">+977</span>
              <input
                type="tel"
                placeholder="9841234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                className="flex-1 px-4 py-3 bg-[var(--color-surface)] rounded-r-xl text-lg font-mono border border-gray-100 dark:border-gray-700 focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none"
                maxLength={10}
              />
            </div>
          </div>

          {error && (
            <div role="alert" className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-4 py-2 rounded-xl">{error}</div>
          )}

          <button
            onClick={handleForgotPhoneSubmit}
            disabled={phone.length < 10 || loading}
            className="w-full py-3.5 bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : "Send Reset OTP"}
          </button>

          <button onClick={() => { setStep("pin"); setError(""); }} className="w-full text-center text-sm text-[var(--color-text-muted)] active:text-[var(--color-primary)] transition-colors py-3">
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
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
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
              className="w-full mt-1 px-4 py-3 bg-[var(--color-surface)] rounded-xl text-2xl font-mono text-center border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none tracking-widest"
              maxLength={6}
            />
          </div>

          <div className="space-y-4 pt-2 border-t border-gray-100 dark:border-gray-700">
            <p className="text-xs text-[var(--color-text-muted)] text-center">Set a new 4-digit PIN</p>
            {renderPinDots(newPin, setNewPin, newPinRefs, "New PIN")}
            {renderPinDots(confirmPin, setConfirmPin, confirmPinRefs, "Confirm PIN")}
          </div>

          {error && (
            <div role="alert" className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-4 py-2 rounded-xl">{error}</div>
          )}

          <button
            onClick={handleForgotOtpSubmit}
            disabled={otp.length < 4 || pinArrayToString(newPin).length < 4 || pinArrayToString(confirmPin).length < 4 || loading}
            className="w-full py-3.5 bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : "Verify & Reset PIN"}
          </button>

          <button onClick={() => { setStep("forgot_phone"); setError(""); }} className="w-full text-center text-sm text-[var(--color-text-muted)] active:text-[var(--color-primary)] transition-colors py-3">
            Back
          </button>
        </div>
      )}
    </div>
  );
}
