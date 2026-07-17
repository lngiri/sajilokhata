"use client";

import { useState, useEffect, useRef } from "react";
import BottomNav from "@/components/BottomNav";
import { useToast } from "@/components/Toast";
import { getCurrentMerchantId } from "@/lib/auth";
import {
  initiateEsewaPayment,
  getMerchantSmsBalance,
  getMerchantRechargeHistory,
  createManualSmsRequest,
} from "@/app/actions/sms-billing";
import { getReminderLogs } from "@/app/actions/merchant";
import { SMS_PACKAGES, type SmsPackageType } from "@/lib/types/sms-billing";

type PackageKey = SmsPackageType;

const PACKAGE_META: Record<PackageKey, { color: string; popular?: boolean }> = {
  small: { color: "from-blue-500 to-blue-600" },
  medium: { color: "from-[var(--color-primary)] to-[var(--color-primary-dark)]", popular: true },
  large: { color: "from-purple-500 to-purple-600" },
};

const ADMIN_PAYMENT_INFO = {
  esewa: "98XXXXXXXX",
  bank: "NMB Bank, Account: XXXX-XXXX-XXXX",
};

export default function BillingPage() {
  const { addToast } = useToast();
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [smsBalance, setSmsBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<PackageKey | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [reminderLogs, setReminderLogs] = useState<any[]>([]);
  const formRef = useRef<HTMLFormElement>(null);

  // Payment modal state
  const [showModal, setShowModal] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState<PackageKey | null>(null);
  const [transactionId, setTransactionId] = useState("");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const init = async () => {
      const mid = await getCurrentMerchantId();
      if (!mid) return;
      setMerchantId(mid);
      const [balance, history, reminders] = await Promise.all([
        getMerchantSmsBalance(mid),
        getMerchantRechargeHistory(mid),
        getReminderLogs(mid),
      ]);
      setSmsBalance(balance);
      if (history.success) setLogs(history.logs || []);
      setReminderLogs(reminders);
      setLoading(false);
    };
    init();
  }, []);

  const openModal = (pkg: PackageKey) => {
    setSelectedPkg(pkg);
    setTransactionId("");
    setScreenshotFile(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedPkg(null);
    setTransactionId("");
    setScreenshotFile(null);
  };

  const handleManualSubmit = async () => {
    if (!merchantId || !selectedPkg) return;
    const pkg = SMS_PACKAGES[selectedPkg];
    if (!transactionId.trim()) {
      addToast("Please enter your eSewa transaction ID", "error");
      return;
    }
    if (!screenshotFile) {
      addToast("Please upload a payment screenshot", "error");
      return;
    }

    setSubmitting(true);
    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("File read failed"));
        reader.readAsDataURL(screenshotFile);
      });

      const fd = new FormData();
      fd.append("merchantId", merchantId);
      fd.append("amount", String(pkg.amount));
      fd.append("smsCount", String(pkg.sms_count));
      fd.append("transactionId", transactionId.trim());
      fd.append("screenshot", base64);

      const result = await createManualSmsRequest(fd);
      if (result.success) {
        addToast("Payment request submitted! Awaiting admin approval.", "success");
        closeModal();
      } else {
        addToast(result.error || "Failed to submit request", "error");
      }
    } catch {
      addToast("Something went wrong", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center pb-24">
        <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] pb-24">
      {/* Hidden form for future eSewa redirect */}
      <form ref={formRef} style={{ display: "none" }} />

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text)]">SMS Credits</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Recharge to send payment reminders</p>
        </div>

        {/* Balance Badge */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-50 p-6 text-center">
          <p className="text-sm text-[var(--color-text-muted)] mb-1">Current Balance</p>
          <p className="text-4xl font-bold text-[var(--color-text)]">{smsBalance}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">SMS credits remaining</p>
        </div>

        {/* Low Balance Warning */}
        {smsBalance <= 5 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <p className="text-sm text-amber-800">
              Your SMS balance is running low.{" "}
              <span className="font-medium">Recharge below to continue sending payment reminders.</span>
            </p>
          </div>
        )}

        {/* Plan Cards */}
        <section>
          <h2 className="font-semibold text-[var(--color-text)] mb-3">Recharge Packages</h2>
          <div className="grid grid-cols-3 gap-3">
            {(Object.entries(SMS_PACKAGES) as [PackageKey, typeof SMS_PACKAGES[PackageKey]][]).map(([key, pkg]) => {
              const meta = PACKAGE_META[key];
              return (
                <div
                  key={key}
                  className={`relative bg-white rounded-2xl shadow-sm border border-gray-50 p-4 flex flex-col items-center text-center ${meta.popular ? "ring-2 ring-[var(--color-primary)]" : ""}`}
                >
                  {meta.popular && (
                    <span className="absolute -top-2.5 bg-[var(--color-primary)] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                      BEST VALUE
                    </span>
                  )}
                  <p className="text-2xl font-bold text-[var(--color-text)] mt-1">Rs. {pkg.amount}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">{pkg.sms_count} SMS</p>
                  <p className="text-[10px] text-[var(--color-text-muted)]">
                    Rs. {(pkg.amount / pkg.sms_count).toFixed(2)}/SMS
                  </p>
                  <button
                    onClick={() => openModal(key)}
                    className={`mt-3 w-full py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r ${meta.color} active:scale-[0.97] transition-transform`}
                  >
                    Buy Now
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* How It Works */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-50 p-4 space-y-2">
          <h3 className="font-semibold text-sm text-[var(--color-text)]">How it works</h3>
          <ol className="text-xs text-[var(--color-text-muted)] space-y-1 list-decimal list-inside">
            <li>Choose a package and click <strong>Buy Now</strong></li>
            <li>Send payment via eSewa or Bank Transfer (see details in modal)</li>
            <li>Upload the payment screenshot with your transaction ID</li>
            <li>SMS credits are added after admin verification</li>
          </ol>
        </div>

        {/* Recharge History */}
        {logs.length > 0 && (
          <section>
            <h2 className="font-semibold text-[var(--color-text)] mb-3">Recharge History</h2>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-50 divide-y divide-gray-100">
              {logs.map((log: any) => (
                <div key={log.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text)]">
                      +{log.sms_count} SMS
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Rs. {Number(log.amount).toLocaleString()} &middot; {new Date(log.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      log.status === "completed"
                        ? "bg-green-100 text-green-700"
                        : log.status === "failed"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SMS History */}
        {reminderLogs.length > 0 && (
          <section>
            <h2 className="font-semibold text-[var(--color-text)] mb-3">SMS History</h2>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-50 divide-y divide-gray-100">
              {reminderLogs.map((log: any) => (
                <div key={log.id} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text)] truncate">
                      {log.customers?.name || "Unknown"}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {log.customers?.phone && `${log.customers.phone} · `}
                      {new Date(log.sent_at).toLocaleString("en-US", {
                        month: "short", day: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                      {log.type === "share_link" ? " · Shared" : ""}
                    </p>
                    <p className="text-xs text-gray-400 truncate mt-0.5 max-w-[220px]">
                      {log.message}
                    </p>
                  </div>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${
                      log.status === "sent"
                        ? "bg-green-100 text-green-700"
                        : log.status === "failed"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {log.type === "share_link" ? "Shared" : log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ─── Payment Method Modal ─────────────────────────────── */}
      {showModal && selectedPkg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm max-h-[85vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-[var(--color-text)]">Select Payment Method</h3>
                <button onClick={closeModal} className="p-1 text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-[var(--color-text-muted)] mt-1">
                Package: Rs. {SMS_PACKAGES[selectedPkg].amount} — {SMS_PACKAGES[selectedPkg].sms_count} SMS
              </p>
            </div>

            <div className="p-5 space-y-4">
              {/* Option 1: Auto eSewa (Coming Soon) */}
              <div className="relative border border-gray-200 rounded-xl p-4 opacity-60 grayscale">
                <span className="absolute -top-2.5 right-3 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Coming Soon
                </span>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-400">Pay via eSewa (Auto)</p>
                    <p className="text-xs text-gray-400">Instant automatic credit</p>
                  </div>
                </div>
              </div>

              {/* Option 2: Manual Transfer */}
              <div className="border border-[var(--color-primary)]/30 rounded-xl p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text)]">Manual Bank / eSewa Transfer</p>
                    <p className="text-xs text-[var(--color-text-muted)]">Upload payment proof for manual verification</p>
                  </div>
                </div>

                {/* Payment Instructions */}
                <div className="bg-gray-50 rounded-xl px-3 py-3 space-y-1 text-xs text-[var(--color-text-muted)]">
                  <p><span className="font-medium text-gray-700">eSewa ID:</span> {ADMIN_PAYMENT_INFO.esewa}</p>
                  <p><span className="font-medium text-gray-700">Bank:</span> {ADMIN_PAYMENT_INFO.bank}</p>
                  <p className="text-[10px] text-gray-400 mt-1">Send the exact package amount and upload the screenshot below.</p>
                </div>

                {/* Form */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text)] mb-1">Amount (NPR)</label>
                    <input
                      type="text"
                      value={`Rs. ${SMS_PACKAGES[selectedPkg].amount}`}
                      disabled
                      className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text)] mb-1">SMS Credits</label>
                    <input
                      type="text"
                      value={`${SMS_PACKAGES[selectedPkg].sms_count} SMS`}
                      disabled
                      className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text)] mb-1">
                      eSewa Transaction ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      placeholder="e.g. ESMF-XXXXXX"
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text)] mb-1">
                      Payment Screenshot <span className="text-red-500">*</span>
                    </label>
                    <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 border-dashed cursor-pointer hover:bg-gray-50 transition-colors">
                      <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                      <span className="text-sm text-gray-500">
                        {screenshotFile ? screenshotFile.name : "Upload screenshot"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => setScreenshotFile(e.target.files?.[0] || null)}
                      />
                    </label>
                    {screenshotFile && (
                      <p className="text-[11px] text-green-600 mt-1">
                        {(screenshotFile.size / 1024).toFixed(1)} KB selected
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleManualSubmit}
                  disabled={submitting}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-dark)] active:scale-[0.98] transition-transform disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Request"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
