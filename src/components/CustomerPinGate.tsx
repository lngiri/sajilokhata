"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { checkCustomerHasPin, verifyCustomerPin, setCustomerPin } from "@/app/actions/customer-pin";

interface Props {
  phone: string;
  /**
   * Called once the gate is unlocked (PIN verified) or when
   * the user completes the initial set-PIN flow.
   */
  onUnlocked: () => void;
  /**
   * Called when the user wants to switch accounts
   * (e.g. sign out and re-scan).
   */
  onSignOut?: () => void;
  children: React.ReactNode;
}

type GateStep = "loading" | "pin" | "set_pin" | "unlocked";

export default function CustomerPinGate({ phone, onUnlocked, onSignOut, children }: Props) {
  const [step, setStep] = useState<GateStep>("loading");
  const [pin, setPin] = useState(["", "", "", ""]);
  const [newPin, setNewPin] = useState(["", "", "", ""]);
  const [confirmPin, setConfirmPin] = useState(["", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const pinRefs = useRef<(HTMLInputElement | null)[]>([null, null, null, null]);
  const newPinRefs = useRef<(HTMLInputElement | null)[]>([null, null, null, null]);

  useEffect(() => {
    if (!phone) return;
    let cancelled = false;
    (async () => {
      const { hasPin } = await checkCustomerHasPin(phone);
      if (cancelled) return;
      setStep(hasPin ? "pin" : "unlocked");
    })();
    return () => { cancelled = true; };
  }, [phone]);

  const focusInput = useCallback((refs: React.MutableRefObject<(HTMLInputElement | null)[]>, idx: number) => {
    if (idx >= 0 && idx < 4) refs.current[idx]?.focus();
  }, []);

  const handleDigit = (
    value: string,
    idx: number,
    arr: string[],
    setter: (v: string[]) => void,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>,
  ) => {
    if (!/^\d*$/.test(value)) return;
    const digit = value.slice(-1);
    const next = [...arr];
    next[idx] = digit;
    setter(next);
    if (digit && idx < 3) focusInput(refs, idx + 1);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    idx: number,
    arr: string[],
    setter: (v: string[]) => void,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>,
  ) => {
    if (e.key === "Backspace" && !arr[idx] && idx > 0) {
      const next = [...arr];
      next[idx - 1] = "";
      setter(next);
      focusInput(refs, idx - 1);
    }
  };

  const pinArrToString = (a: string[]) => a.join("");

  const handlePinSubmit = async () => {
    const p = pinArrToString(pin);
    if (p.length < 4 || !phone) return;
    setLoading(true);
    setError("");
    const result = await verifyCustomerPin(phone, p);
    if (!result.success) {
      setError(result.error || "Incorrect PIN");
      setPin(["", "", "", ""]);
      focusInput(pinRefs, 0);
      setLoading(false);
      return;
    }
    setStep("unlocked");
  };

  const handleSetPin = async () => {
    const newP = pinArrToString(newPin);
    const confirm = pinArrToString(confirmPin);
    if (newP.length < 4) { setError("Enter a 4-digit PIN"); return; }
    if (newP !== confirm) { setError("PINs do not match"); return; }
    if (!phone) return;
    setLoading(true);
    setError("");
    const result = await setCustomerPin(phone, newP);
    if (!result.success) {
      setError(result.error || "Failed to set PIN");
      setLoading(false);
      return;
    }
    setStep("unlocked");
  };

  const handleSkip = () => {
    setStep("unlocked");
  };

  if (step === "unlocked") return <>{children}</>;

  const renderDots = (
    arr: string[],
    setter: (v: string[]) => void,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>,
    label: string,
  ) => (
    <div>
      <p className="text-sm font-medium text-[var(--color-text)] mb-3 text-center">{label}</p>
      <div className="flex justify-center gap-3">
        {arr.map((d, i) => (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            type="tel"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={(e) => handleDigit(e.target.value, i, arr, setter, refs)}
            onKeyDown={(e) => handleKeyDown(e, i, arr, setter, refs)}
            onFocus={(e) => e.target.select()}
            className="w-14 h-14 text-center text-2xl font-bold bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[70] bg-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-xs space-y-6">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-[var(--color-primary)]/10 flex items-center justify-center">
            <svg className="w-7 h-7 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-[var(--color-text)]">
            {step === "pin" ? "Enter PIN" : "Set a PIN"}
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {step === "pin"
              ? "Enter your 4-digit PIN to continue"
              : "Protect your account with a 4-digit PIN"}
          </p>
        </div>

        {step === "pin" && (
          <>
            {renderDots(pin, setPin, pinRefs, "PIN")}
            {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-xl text-center">{error}</div>}
            <button
              onClick={handlePinSubmit}
              disabled={pinArrToString(pin).length < 4 || loading}
              className="w-full py-3.5 bg-[var(--color-primary)] text-white rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : "Unlock"}
            </button>
          </>
        )}

        {step === "set_pin" && (
          <>
            {renderDots(newPin, setNewPin, newPinRefs, "New PIN")}
            {renderDots(confirmPin, setConfirmPin, newPinRefs, "Confirm PIN")}
            {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-xl text-center">{error}</div>}
            <button
              onClick={handleSetPin}
              disabled={pinArrToString(newPin).length < 4 || pinArrToString(confirmPin).length < 4 || loading}
              className="w-full py-3.5 bg-[var(--color-primary)] text-white rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : "Set PIN"}
            </button>
            <button onClick={handleSkip} className="w-full text-center text-sm text-[var(--color-text-muted)] active:text-[var(--color-primary)]">
              Skip for now
            </button>
          </>
        )}

        {onSignOut && (
          <button onClick={onSignOut} className="w-full text-center text-xs text-gray-400 active:text-red-500">
            Sign out
          </button>
        )}
      </div>
    </div>
  );
}
