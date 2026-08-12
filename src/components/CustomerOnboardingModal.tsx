"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { updateCustomerProfile } from "@/app/actions/customer";

const CUSTOMER_STORAGE_KEY = "sajilo_customer_session";

interface Props {
  phone: string;
  onComplete: () => void;
}

export default function CustomerOnboardingModal({ phone, onComplete }: Props) {
  const t = useTranslations("onboarding");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CUSTOMER_STORAGE_KEY);
      if (raw) {
        const session = JSON.parse(raw);
        if (session.name && session.name !== "Customer") {
          setName(session.name);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const valid = name.trim().length > 0;

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
      const result = await updateCustomerProfile(phone, {
        name: name.trim(),
        address: address.trim() || undefined,
      });
      if (!result.success) {
        setError(result.error || t("common.error"));
        return;
      }
      try {
        const raw = localStorage.getItem(CUSTOMER_STORAGE_KEY);
        const session = raw ? JSON.parse(raw) : { phone };
        session.name = name.trim();
        localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(session));
      } catch {}
      onComplete();
    } catch {
      setError(t("common.networkError"));
    } finally {
      setSaving(false);
    }
  }, [valid, saving, phone, name, address, onComplete, t]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center backdrop-blur-xl bg-slate-900/50 p-4">
      <div className="bg-white dark:bg-[var(--color-surface)] rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-5 animate-scale-up">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-[var(--color-text)]">{t("title")}</h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">{t("subtitle")}</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{t("nameLabel")}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
              className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
              {t("addressLabel")}
              <span className="text-[var(--color-text-muted)] font-normal"> {t("common.optional")}</span>
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t("addressPlaceholder")}
              className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition"
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-500 text-center">{error}</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onComplete}
            className="flex-1 py-3 rounded-xl font-medium text-[var(--color-text-muted)] bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          >
            {t("skip")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!valid || saving}
            className="flex-1 py-3 rounded-xl font-semibold text-white bg-[var(--color-primary-surface)] hover:bg-[var(--color-primary-surface-hover)] disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {t("common.saving")}
              </>
            ) : (
              t("saveAndContinue")
            )}
          </button>
        </div>
      </div>
    </div>
  );
}