"use client";

import { useState, useCallback, useEffect } from "react";
import { QRScanner, CustomerQR } from "@/components/QRCode";
import { useToast } from "@/components/Toast";
import {
  findOrCreateCustomer,
  linkCustomerToMerchant,
  createCreditLog,
} from "@/lib/actions";
import { isOnline, saveOfflineCustomer, savePendingLog } from "@/lib/offline/db";

type Step = "phone" | "scan" | "enter" | "reverse" | "done";

/** Key used to persist customer session in localStorage */
const CUSTOMER_STORAGE_KEY = "sajilo_customer_session";

interface CustomerSession {
  phone: string;
  name: string;
}

function loadCustomerSession(): CustomerSession | null {
  try {
    const raw = localStorage.getItem(CUSTOMER_STORAGE_KEY);
    if (raw) {
      const session = JSON.parse(raw) as CustomerSession;
      if (session.phone && session.phone.length >= 10) {
        return session;
      }
    }
  } catch {
    // Corrupted data — ignore
  }
  return null;
}

/** Cookie name used by middleware to protect /customer/* routes server-side */
const CUSTOMER_COOKIE_NAME = "customer_session";

function saveCustomerSession(phone: string, name: string) {
  try {
    localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify({ phone, name }));
    // Also set a cookie so middleware can verify the session server-side
    // This prevents flash-of-content when navigating directly to /customer/*
    document.cookie = `${CUSTOMER_COOKIE_NAME}=${encodeURIComponent(JSON.stringify({ phone, name }))}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`;
  } catch {
    // localStorage full or unavailable
  }
}

function clearCustomerSession() {
  try {
    localStorage.removeItem(CUSTOMER_STORAGE_KEY);
    // Expire the cookie immediately
    document.cookie = `${CUSTOMER_COOKIE_NAME}=; path=/; max-age=0`;
  } catch {
    // Ignore
  }
}

export default function ScanPage() {
  const { addToast } = useToast();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [merchantId, setMerchantId] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // On mount, restore customer session from localStorage
  useEffect(() => {
    const session = loadCustomerSession();
    if (session) {
      setPhone(session.phone);
      setName(session.name);
      setStep("scan");
    }
    setInitialized(true);
  }, []);

  const handlePhoneSubmit = async () => {
    if (!phone || phone.length < 10) return;

    // Save customer locally for future recognition
    await saveOfflineCustomer({
      id: crypto.randomUUID(),
      phone,
      name: name || undefined,
    });

    // Persist session so they never see the phone screen again
    saveCustomerSession(phone, name);

    setStep("scan");
  };

  const handleResetPhone = () => {
    clearCustomerSession();
    setPhone("");
    setName("");
    setStep("phone");
  };

  const handleQRScan = useCallback(
    (data: string) => {
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === "merchant_scan") {
          setMerchantId(parsed.merchantId);
          setMerchantName(parsed.merchantName);
          setStep("enter");
        } else {
          addToast("Invalid QR code. Please scan a shop QR.", "error");
        }
      } catch {
        addToast("Invalid QR code. Please scan a shop QR.", "error");
      }
    },
    [addToast]
  );

  const handleSubmitEntry = async () => {
    if (!amount || Number(amount) <= 0) return;
    setLoading(true);

    try {
      if (isOnline()) {
        const customer = await findOrCreateCustomer(phone, name || undefined);
        await linkCustomerToMerchant(merchantId, customer.id);
        await createCreditLog({
          merchant_id: merchantId,
          customer_id: customer.id,
          amount: Number(amount),
          description: description || null,
          type: "debit",
          status: "pending",
          sync_status: "online",
        });
        addToast("Credit request sent! Awaiting merchant approval.", "success");
        setStep("done");
      } else {
        await savePendingLog({
          id: crypto.randomUUID(),
          merchant_id: merchantId,
          customer_id: "",
          customerPhone: phone,
          amount: Number(amount),
          description: description || null,
          type: "debit",
          status: "pending",
          sync_status: "offline_pending",
          created_at: new Date().toISOString(),
        });
        setStep("reverse");
      }
    } catch (err) {
      console.error("Failed to submit entry:", err);
      addToast("Failed to submit. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Prevent flash of phone screen while checking localStorage
  if (!initialized) {
    return (
      <div className="min-h-dvh bg-[var(--color-bg)] flex items-center justify-center">
        <div role="status" className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[var(--color-bg)]">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center px-4 py-3">
          <a href="/" className="mr-3 p-1 active:scale-95 transition-transform">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </a>
          <h1 className="text-lg font-bold text-[var(--color-text)]">
            {step === "phone" ? "Enter Phone" : step === "scan" ? "Scan QR" : step === "enter" ? "Log Entry" : step === "reverse" ? "Show QR" : "Done!"}
          </h1>
        </div>
      </div>

      {/* Step 1: Phone Entry */}

      {step === "phone" && (
        <div className="px-6 py-12 space-y-6 animate-fade-in">
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-[var(--color-primary)]/10 flex items-center justify-center">
              <svg className="w-10 h-10 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
              </svg>
            </div>
            <p className="text-sm text-[var(--color-text-muted)]">
              Enter your phone number to get started (one-time)
            </p>
          </div>

          <div className="space-y-3">
            <label className="sr-only" htmlFor="scan-phone">Phone Number</label>
            <input
              id="scan-phone"
              type="tel"
              placeholder="e.g. 9841234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              className="w-full px-4 py-4 bg-white rounded-2xl text-lg font-mono border border-gray-100 focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none text-center"
              maxLength={10}
            />
            <label className="sr-only" htmlFor="scan-name">Your Name</label>
            <input
              id="scan-name"
              type="text"
              placeholder="Your name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-white rounded-2xl border border-gray-100 focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none text-center"
            />
          </div>

          <button
            onClick={handlePhoneSubmit}
            disabled={phone.length < 10}
            className="w-full py-4 bg-[var(--color-primary)] text-white rounded-2xl font-semibold text-lg active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      )}

      {/* Step 2: Scan QR */}
      {step === "scan" && (
        <div className="px-4 py-6 space-y-4 animate-fade-in">
          {/* Persisted customer badge */}
          <div className="flex items-center justify-between bg-white rounded-xl px-4 py-2.5 shadow-sm border border-gray-50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--color-text)]">
                  {name || phone}
                </p>
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  {name ? `${phone} · Saved` : "Saved"}
                </p>
              </div>
            </div>
            <button
              onClick={handleResetPhone}
              className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-danger)] px-2.5 py-1 rounded-lg active:scale-95 transition-all"
            >
              Change
            </button>
          </div>

          <p className="text-center text-sm text-[var(--color-text-muted)]">
            Point your camera at the shop&apos;s QR code
          </p>
          <QRScanner onScan={handleQRScan} />
          <p className="text-center text-xs text-[var(--color-text-muted)]">
            Ask the shopkeeper to show their QR code
          </p>
        </div>
      )}

      {/* Step 3: Enter Amount */}
      {step === "enter" && (
        <div className="px-6 py-8 space-y-6 animate-fade-in">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-50 text-center">
            <p className="text-xs text-[var(--color-text-muted)] mb-1">Logging entry at</p>
            <p className="font-bold text-lg text-[var(--color-text)]">{merchantName}</p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-[var(--color-text)]">Amount (NPR)</label>
              <input
                type="number"
                min="1"
                step="1"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full mt-1 px-4 py-4 bg-white rounded-2xl text-3xl font-bold text-center border border-gray-100 focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--color-text)]">Description</label>
              <input
                type="text"
                maxLength={200}
                placeholder="e.g. Rice 10kg, Milk 2L"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full mt-1 px-4 py-3 bg-white rounded-2xl border border-gray-100 focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep("scan")}
              className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium active:scale-[0.98]"
            >
              Back
            </button>
            <button
              onClick={handleSubmitEntry}
              disabled={!amount || Number(amount) <= 0 || loading}
              className="flex-1 py-3 bg-[var(--color-primary)] text-white rounded-xl font-medium active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : isOnline() ? (
                "Submit Entry"
              ) : (
                "Generate QR"
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Reverse QR (Offline mode) */}
      {step === "reverse" && (
        <div className="px-4 py-6 space-y-6 animate-fade-in">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50">
            <CustomerQR customerId={phone} />
          </div>

          <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-amber-800">You are offline</p>
                <p className="text-xs text-amber-700 mt-1">
                  Show this QR to the shopkeeper so they can scan and save your entry. It will sync when you&apos;re back online.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep("enter")}
              className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium active:scale-[0.98]"
            >
              Edit Amount
            </button>
            <button
              onClick={() => setStep("done")}
              className="flex-1 py-3 bg-[var(--color-primary)] text-white rounded-xl font-medium active:scale-[0.98]"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Done */}
      {step === "done" && (
        <div className="px-6 py-12 text-center animate-fade-in">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center">
            <svg className="w-10 h-10 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">Entry Submitted!</h2>
          <p className="text-sm text-[var(--color-text-muted)] mb-8">
            The shopkeeper will review and approve your entry.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setAmount("");
                setDescription("");
                setMerchantId("");
                setMerchantName("");
                setStep("scan");
              }}
              className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-semibold active:scale-[0.98]"
            >
              New Entry
            </button>
            <a
              href="/customer/dashboard"
              className="flex-1 py-3 bg-[var(--color-primary)] text-white rounded-xl font-semibold active:scale-[0.98] inline-flex items-center justify-center"
            >
              Go to Dashboard
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
