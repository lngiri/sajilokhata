"use client";

import { useState, useCallback } from "react";
import { QRScanner, ReverseQR } from "@/components/QRCode";
import { useToast } from "@/components/Toast";
import { saveOfflineCustomer, getOfflineCustomerByPhone } from "@/lib/offline/db";

type Step = "phone" | "scan" | "enter" | "reverse" | "done";

export default function ScanPage() {
  const { addToast } = useToast();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [merchantId, setMerchantId] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const handlePhoneSubmit = async () => {
    if (!phone || phone.length < 10) return;

    // Save customer locally for future recognition
    await saveOfflineCustomer({
      id: crypto.randomUUID(),
      phone,
      name: name || undefined,
    });

    setStep("scan");
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

  const handleSubmitEntry = () => {
    if (!amount || Number(amount) <= 0) return;
    setStep("reverse");
  };

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
              Enter your phone number (saved locally for next time)
            </p>
          </div>

          <div className="space-y-3">
            <input
              type="tel"
              placeholder="e.g. 9841234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              className="w-full px-4 py-4 bg-white rounded-2xl text-lg font-mono border border-gray-100 focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none text-center"
              maxLength={10}
            />
            <input
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
              disabled={!amount || Number(amount) <= 0}
              className="flex-1 py-3 bg-[var(--color-primary)] text-white rounded-xl font-medium active:scale-[0.98] disabled:opacity-50"
            >
              Generate QR
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Reverse QR (Offline mode) */}
      {step === "reverse" && (
        <div className="px-4 py-6 space-y-6 animate-fade-in">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50">
            <ReverseQR
              merchantId={merchantId}
              customerId={phone}
              amount={Number(amount)}
              description={description}
            />
          </div>

          <div className="bg-[var(--color-primary)]/5 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-[var(--color-primary)] mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-[var(--color-text)]">Show this QR to the shopkeeper</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  The shopkeeper will scan this QR to confirm your entry. Works offline too!
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
          <button
            onClick={() => {
              setStep("phone");
              setPhone("");
              setName("");
              setAmount("");
              setDescription("");
              setMerchantId("");
              setMerchantName("");
            }}
            className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-medium active:scale-[0.98]"
          >
            Make Another Entry
          </button>
        </div>
      )}
    </div>
  );
}
