"use client";

import { useState, useCallback } from "react";
import { QRScanner } from "@/components/QRCode";
import { useToast } from "@/components/Toast";
import BottomNav from "@/components/BottomNav";
import { getCurrentMerchantId } from "@/lib/auth";
import {
  findOrCreateCustomer,
  linkCustomerToMerchant,
  createCreditLog,
} from "@/lib/actions";

type Step = "scan" | "confirm" | "success";

interface ScannedData {
  type: string;
  merchantId: string;
  customerId: string;
  amount: number;
  description?: string;
}

export default function MerchantScanPage() {
  const { addToast } = useToast();
  const [step, setStep] = useState<Step>("scan");
  const [scannedData, setScannedData] = useState<ScannedData | null>(null);
  const [saving, setSaving] = useState(false);
  const [customerName, setCustomerName] = useState<string | null>(null);

  const handleScan = useCallback(
    async (data: string) => {
      try {
        const parsed = JSON.parse(data);

        if (parsed.type !== "reverse_scan") {
          addToast("Invalid QR. Please scan a customer's credit QR.", "error");
          return;
        }

        // Verify it belongs to the logged-in merchant
        const currentMerchantId = await getCurrentMerchantId();
        if (!currentMerchantId) {
          addToast("Not logged in. Please login first.", "error");
          return;
        }

        if (parsed.merchantId !== currentMerchantId) {
          addToast("This QR belongs to a different shop.", "error");
          return;
        }

        setScannedData(parsed);
        setStep("confirm");
      } catch {
        addToast("Invalid QR code format.", "error");
      }
    },
    [addToast]
  );

  const handleConfirm = async () => {
    if (!scannedData) return;
    setSaving(true);

    try {
      const merchantId = await getCurrentMerchantId();
      if (!merchantId) {
        addToast("Not logged in", "error");
        setSaving(false);
        return;
      }

      // 1. Find or create the customer by phone
      const customer = await findOrCreateCustomer(scannedData.customerId);
      setCustomerName(customer.name || null);

      // 2. Link customer to merchant
      await linkCustomerToMerchant(merchantId, customer.id);

      // 3. Create the credit log
      await createCreditLog({
        merchant_id: merchantId,
        customer_id: customer.id,
        amount: scannedData.amount,
        description: scannedData.description || null,
        type: "debit",
        status: "pending",
        sync_status: "online",
      });

      setStep("success");
      addToast("Credit entry saved! Review it in the Ledger.", "success");
    } catch (err) {
      console.error("Failed to save credit entry:", err);
      addToast("Failed to save. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setStep("scan");
    setScannedData(null);
    setCustomerName(null);
  };

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center px-4 py-3">
          <a
            href="/merchant/dashboard"
            className="mr-3 p-1 active:scale-95 transition-transform"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 19.5L8.25 12l7.5-7.5"
              />
            </svg>
          </a>
          <h1 className="text-lg font-bold text-[var(--color-text)]">
            {step === "scan"
              ? "Scan Customer QR"
              : step === "confirm"
              ? "Confirm Entry"
              : "Entry Saved!"}
          </h1>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {step === "scan" && (
          <div className="space-y-4 animate-fade-in">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-[var(--color-primary)]/10 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-[var(--color-primary)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z"
                  />
                </svg>
              </div>
              <p className="text-sm text-[var(--color-text-muted)]">
                Point your camera at the customer&apos;s QR code
              </p>
            </div>

            <QRScanner onScan={handleScan} />

            <div className="bg-[var(--color-primary)]/5 rounded-2xl p-4 space-y-2">
              <div className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-[var(--color-primary)] mt-0.5 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
                  />
                </svg>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Ask the customer to show the QR from their phone. The entry
                  will be saved as pending — you can approve it from the Ledger.
                </p>
              </div>
            </div>
          </div>
        )}

        {step === "confirm" && scannedData && (
          <div className="space-y-4 animate-fade-in">
            {/* Scanned Details Card */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-50 space-y-4">
              <div className="text-center pb-2 border-b border-gray-50">
                <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-green-50 flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-green-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <p className="text-xs text-[var(--color-text-muted)]">
                  QR Scanned Successfully
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-xs text-[var(--color-text-muted)] mb-0.5">
                    Customer Phone
                  </p>
                  <p className="font-mono font-medium text-[var(--color-text)]">
                    {scannedData.customerId}
                  </p>
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <p className="text-xs text-[var(--color-text-muted)] mb-0.5">
                      Amount
                    </p>
                    <p className="text-2xl font-bold text-[var(--color-danger)]">
                      NPR {scannedData.amount.toLocaleString()}
                    </p>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-[var(--color-text-muted)] mb-0.5">
                      Type
                    </p>
                    <span className="inline-block px-2.5 py-1 bg-[var(--color-accent)]/10 text-[var(--color-accent)] text-xs font-medium rounded-full">
                      Debit (Credit Taken)
                    </span>
                  </div>
                </div>
                {scannedData.description && (
                  <div>
                    <p className="text-xs text-[var(--color-text-muted)] mb-0.5">
                      Description
                    </p>
                    <p className="text-sm text-[var(--color-text)]">
                      {scannedData.description}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleReset}
                disabled={saving}
                className="flex-1 py-3.5 bg-gray-100 text-gray-600 rounded-xl font-medium active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={saving}
                className="flex-1 py-3.5 bg-[var(--color-primary)] text-white rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.5 12.75l6 6 9-13.5"
                      />
                    </svg>
                    Save Entry
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="text-center py-8 space-y-6 animate-fade-in">
            <div className="w-20 h-20 mx-auto rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center">
              <svg
                className="w-10 h-10 text-[var(--color-primary)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 12.75l6 6 9-13.5"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--color-text)] mb-1">
                Entry Saved!
              </h2>
              <p className="text-sm text-[var(--color-text-muted)]">
                {customerName
                  ? `Credit of NPR ${scannedData?.amount.toLocaleString()} added for ${customerName}`
                  : `Credit of NPR ${scannedData?.amount.toLocaleString()} saved as pending`}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleReset}
                className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium active:scale-[0.98] transition-transform"
              >
                Scan Another
              </button>
              <a
                href="/merchant/logs"
                className="flex-1 py-3 bg-[var(--color-primary)] text-white rounded-xl font-medium active:scale-[0.98] transition-transform flex items-center justify-center"
              >
                View Ledger
              </a>
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
