"use client";

import { useState, useRef, useEffect } from "react";
import { useToast } from "@/components/Toast";
import {
  addCustomerForMerchant,
  checkCustomerByPhone,
} from "@/app/actions/customer";

interface QuickAddCustomerProps {
  merchantId: string;
  onCustomerAdded: (customer: { id: string; name: string; phone: string }) => void;
  onClose: () => void;
}

export default function QuickAddCustomer({ merchantId, onCustomerAdded, onClose }: QuickAddCustomerProps) {
  const { addToast } = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [exists, setExists] = useState(false);
  const [nameDisabled, setNameDisabled] = useState(true);
  const [lookupMsg, setLookupMsg] = useState("");
  const sentRef = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // Trigger lookup when phone reaches 10 digits or on blur
  const doLookup = async (value: string) => {
    const clean = value.replace(/\D/g, "");
    if (clean.length !== 10) return;
    setLookingUp(true);
    setLookupMsg("");

    try {
      const result = await checkCustomerByPhone(clean);
      if (result.exists && result.customer) {
        setName(result.customer.name || "");
        setExists(true);
        setNameDisabled(true);
        setLookupMsg("Customer already registered");
      } else {
        setName("");
        setExists(false);
        setNameDisabled(false);
        setLookupMsg("");
        // Auto-focus name field after lookup completes
        requestAnimationFrame(() => nameRef.current?.focus());
      }
    } catch {
      setNameDisabled(false);
      setLookupMsg("Lookup failed — you can enter details manually");
    }

    setLookingUp(false);
  };

  // Watch for 10-digit completion
  useEffect(() => {
    if (phone.replace(/\D/g, "").length === 10) {
      doLookup(phone);
    }
  }, [phone]);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedPhone || trimmedPhone.replace(/\D/g, "").length < 6) {
      addToast("Enter a valid phone number (at least 6 digits)", "error");
      return;
    }
    if (!trimmedName && !exists) {
      addToast("Customer name is required", "error");
      return;
    }
    setSaving(true);

    try {
      const result = await addCustomerForMerchant(merchantId, trimmedPhone, trimmedName || undefined);
      if (!result.success) {
        addToast(result.error || "Failed to add customer", "error");
        return;
      }

      const customer = result.customer!;

      if (exists) {
        addToast(`${customer.name || trimmedName} is already a customer`, "success");
      } else {
        // New customer added — show SMS delivery status
        if (result.smsSent) {
          addToast(`${customer.name || trimmedName} added! Registration SMS sent.`, "success");
        } else {
          addToast(
            `${customer.name || trimmedName} added, but SMS could not be sent. ${result.smsError || "Please check the phone number."}`,
            result.smsError ? "warning" : "error"
          );
        }
      }
      onCustomerAdded({ id: customer.id, name: customer.name || trimmedName, phone: trimmedPhone });
      onClose();
    } catch {
      addToast("Failed to add customer. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white dark:bg-[var(--color-surface)] rounded-t-3xl sm:rounded-3xl p-6 space-y-5 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--color-text)]">Add Customer</h2>
          <button onClick={onClose} className="p-1 active:scale-90 transition-transform">
            <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-[var(--color-text)]">Phone Number</label>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">+977</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                onBlur={() => doLookup(phone)}
                placeholder="98XXXXXXXX"
                className="flex-1 px-4 py-3 bg-white dark:bg-[var(--color-surface)] rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all text-center text-lg font-mono"
                autoFocus
              />
              {lookingUp && (
                <div className="w-5 h-5 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
              )}
            </div>
            {lookupMsg && (
              <p className={`text-xs mt-1.5 ${exists ? "text-amber-600" : "text-gray-500 dark:text-gray-400"}`}>
                {lookupMsg}
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-[var(--color-text)]">Name</label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={exists ? "Registered name (auto-filled)" : "e.g. Ram Sharma"}
              maxLength={100}
              disabled={nameDisabled}
              className={`w-full mt-1 px-4 py-3 bg-white dark:bg-[var(--color-surface)] rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all ${
                nameDisabled ? "bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 cursor-not-allowed" : ""
              }`}
            />
            {exists && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                Name is pre-filled — this customer is already in the system
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl font-medium active:scale-[0.98] transition-transform">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || lookingUp || phone.replace(/\D/g, "").length < 6 || (!name.trim() && !exists)}
            className="flex-1 py-3 bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              exists ? "Link Customer" : "Add Customer"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
