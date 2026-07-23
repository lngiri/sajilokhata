"use client";

import { useState, useEffect, useCallback } from "react";

const BUSINESS_TYPES = [
  { value: "kirana", label: "Kirana" },
  { value: "dairy", label: "Dairy" },
  { value: "meat", label: "Meat" },
  { value: "hardware", label: "Hardware" },
  { value: "clothing", label: "Clothing" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "restaurant", label: "Restaurant" },
  { value: "other", label: "Other" },
] as const;

interface Props {
  merchantId: string;
  currentName: string;
  currentAddress: string | null;
  currentBusinessType: string;
  onComplete: (data?: { name: string; address: string; business_type: string }) => void;
}

export default function MerchantOnboardingModal({
  merchantId,
  currentName,
  currentAddress,
  currentBusinessType,
  onComplete,
}: Props) {
  const [name, setName] = useState(currentName);
  const [address, setAddress] = useState(currentAddress || "");
  const [businessType, setBusinessType] = useState(currentBusinessType);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const nameSet = currentName.trim().length > 0;
  const addressSet = (currentAddress || "").trim().length > 0;
  const businessTypeSet = currentBusinessType.trim().length > 0;

  const valid =
    (nameSet || name.trim().length > 0) &&
    (addressSet || address.trim().length > 0) &&
    (businessTypeSet || businessType.trim().length > 0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") e.preventDefault();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!valid || saving) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/merchant/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchant_id: merchantId,
          name: name.trim(),
          address: address.trim(),
          business_type: businessType,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save");
        return;
      }
      onComplete({ name: name.trim(), address: address.trim(), business_type: businessType });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [valid, saving, merchantId, name, address, businessType, onComplete]);

  const missingFields = [];
  if (!nameSet) missingFields.push("business name");
  if (!addressSet) missingFields.push("address");
  if (!businessTypeSet) missingFields.push("business type");

  let subtitle = "Please fill in your business details to continue.";
  if (missingFields.length === 1) {
    subtitle = `Just enter your ${missingFields[0]} to finish.`;
  } else if (missingFields.length === 2) {
    subtitle = `Just enter your ${missingFields.join(" and ")} to finish.`;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-xl bg-slate-900/50 p-4">
      <div className="bg-white dark:bg-[var(--color-surface)] rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-5 animate-scale-up">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-blue-100 flex items-center justify-center">
            <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Complete Your Profile</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
        </div>

        <div className="space-y-4">
          {nameSet ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Business Name</label>
              <div className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-200 dark:text-gray-200 flex items-center gap-2">
                <svg className="w-4 h-4 text-[var(--color-primary)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>{currentName}</span>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Business Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Input your business name here"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                autoFocus={!nameSet}
              />
            </div>
          )}

          {addressSet ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Business Address</label>
              <div className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-200 dark:text-gray-200 flex items-center gap-2">
                <svg className="w-4 h-4 text-[var(--color-primary)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span>{currentAddress}</span>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Business Address *</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Kathmandu, New Road"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition"
                autoFocus={nameSet && !addressSet}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Business Type *</label>
            <select
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition appearance-none bg-white dark:bg-[var(--color-surface)]"
              autoFocus={nameSet && addressSet && !businessTypeSet}
            >
              <option value="">Select your business type</option>
              {BUSINESS_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-500 text-center">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={!valid || saving}
          className="w-full py-3 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            "Save & Continue"
          )}
        </button>
      </div>
    </div>
  );
}
