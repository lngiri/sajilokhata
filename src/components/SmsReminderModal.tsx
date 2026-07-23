"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/Toast";
import { sendPaymentReminder } from "@/app/actions/merchant";

interface SmsReminderModalProps {
  open: boolean;
  onClose: () => void;
  merchantId: string;
  merchantName: string;
  customerId: string;
  customerName: string | null;
  customerPhone: string;
  balance: number;
  smsBalance: number;
}

const MAX_CHARS = 150;

function buildDefaultMessage(
  customerName: string | null,
  balance: number,
  shopName: string
): string {
  const name = customerName || "Customer";
  const firstName = shopName.split(" ")[0];
  return `Dear ${name}, pay Rs. ${Number(balance).toLocaleString()} to ${firstName}.`;
}

export default function SmsReminderModal({
  open,
  onClose,
  merchantId,
  merchantName,
  customerId,
  customerName,
  customerPhone,
  balance,
  smsBalance,
}: SmsReminderModalProps) {
  const { addToast } = useToast();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [confirmStep, setConfirmStep] = useState(false);

  useEffect(() => {
    if (open) {
      setMessage(buildDefaultMessage(customerName, balance, merchantName));
      setSending(false);
      setSharing(false);
      setConfirmStep(false);
    }
  }, [open, customerName, balance, merchantName]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const charCount = message.length;
  const smsCredits = Math.max(1, Math.ceil(charCount / MAX_CHARS));
  const canSend = charCount > 0 && charCount <= MAX_CHARS && smsBalance > 0 && !sending;

  const handleSendSms = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      const result = await sendPaymentReminder(
        merchantId,
        customerId,
        "sms",
        message
      );
      if (result.success) {
        addToast(`SMS sent! ${smsBalance - 1} credit${smsBalance - 1 !== 1 ? "s" : ""} remaining.`, "success");
        onClose();
      } else {
        addToast(result.error || "Failed to send SMS", "error");
      }
    } catch {
      addToast("Failed to send reminder", "error");
    } finally {
      setSending(false);
    }
  };

  const handleShareLink = async () => {
    setSharing(true);
    try {
      const baseUrl = window.location.origin;
      const ledgerLink = `${baseUrl}/customer/history?merchantId=${merchantId}`;
      const shareText = `Dear ${customerName || "Customer"}, your outstanding balance at ${merchantName} is Rs. ${Number(balance).toLocaleString()}. View your ledger: ${ledgerLink}`;

      if (navigator.share) {
        await navigator.share({
          title: `Payment Reminder - ${merchantName}`,
          text: shareText,
          url: ledgerLink,
        });
        addToast("Shared!", "success");
        onClose();
      } else {
        await navigator.clipboard.writeText(shareText);
        addToast("Link copied!", "success");
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        addToast("Failed to share", "error");
      }
    } finally {
      setSharing(false);
    }
  };

  const handleOpenWhatsApp = () => {
    const baseUrl = window.location.origin;
    const ledgerLink = `${baseUrl}/customer/history?merchantId=${merchantId}`;
    const text = `Dear ${customerName || "Customer"}, your outstanding balance at ${merchantName} is Rs. ${Number(balance).toLocaleString()}. View ledger: ${ledgerLink}`;
    const waUrl = `https://wa.me/${customerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank");
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md bg-white dark:bg-[var(--color-surface)] rounded-t-3xl sm:rounded-3xl p-6 animate-slide-up max-h-[90dvh] overflow-y-auto">
        {confirmStep ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-[var(--color-text)]">Confirm Send</h3>
              <button onClick={() => setConfirmStep(false)} className="text-sm text-[var(--color-primary)] font-medium">
                Edit
              </button>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-red-600">
                    {(customerName || customerPhone).charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-[var(--color-text)] truncate">
                    {customerName || customerPhone}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">{customerPhone}</p>
                </div>
              </div>

              <div className="bg-white dark:bg-[var(--color-surface)] rounded-xl p-3 border border-gray-200 dark:border-gray-600">
                <p className="text-sm text-[var(--color-text)] leading-relaxed">{message}</p>
              </div>

              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839 2.51l-4.66-2.51m0 0l-1.023-.55a2.25 2.25 0 00-2.134 0l-1.022.55m0 0l-4.661 2.51m16.5 1.615a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V9.844a2.25 2.25 0 011.183-1.981l6.478-3.488m8.839 2.51l-4.66-2.51" />
                  </svg>
                  <span className="text-sm font-semibold text-[var(--color-primary-dark)]">
                    {smsCredits} SMS credit{smsCredits > 1 ? "s" : ""}
                  </span>
                </div>
                <span className="text-xs text-[var(--color-text-muted)]">{charCount}/{MAX_CHARS} chars</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setConfirmStep(false)}
                className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl font-medium active:scale-[0.98] transition-transform"
              >
                Edit
              </button>
              <button
                onClick={handleSendSms}
                disabled={sending}
                className="flex-1 py-3 bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sending ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                    Confirm & Send
                  </>
                )}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-[var(--color-text)]">Send Reminder</h3>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center active:scale-90 transition-transform">
                <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-red-600">
                    {(customerName || customerPhone).charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-[var(--color-text)] truncate">
                    {customerName || customerPhone}
                  </p>
                  {customerName && (
                    <p className="text-xs text-[var(--color-text-muted)]">{customerPhone}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-[var(--color-text-muted)]">Outstanding</p>
                  <p className="text-lg font-bold text-[var(--color-danger)]">
                    Rs. {Number(balance).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-3">
              <label className="text-sm font-medium text-[var(--color-text)] block mb-1.5">
                Message
              </label>
              <textarea
                value={message}
                onChange={(e) => {
                  if (e.target.value.length <= MAX_CHARS) {
                    setMessage(e.target.value);
                  }
                }}
                className="w-full px-4 py-3 bg-white dark:bg-[var(--color-surface)] rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all resize-none text-sm"
                rows={4}
                placeholder="Type your reminder message..."
              />
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-xs text-[var(--color-text-muted)]">
                  {charCount}/{MAX_CHARS} characters
                </span>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-primary-dark)] bg-[var(--color-primary)]/5 px-2 py-0.5 rounded-full">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839 2.51l-4.66-2.51m0 0l-1.023-.55a2.25 2.25 0 00-2.134 0l-1.022.55m0 0l-4.661 2.51m16.5 1.615a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V9.844a2.25 2.25 0 011.183-1.981l6.478-3.488m8.839 2.51l-4.66-2.51" />
                  </svg>
                  {smsCredits} credit{smsCredits > 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {smsBalance <= 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 flex items-start gap-2.5 mb-4">
                <svg className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <p className="text-xs text-amber-800">
                  No SMS credits remaining.{" "}
                  <a href="/merchant/billing" className="font-medium underline">Recharge to send SMS reminders</a>.
                </p>
              </div>
            )}

            <div className="space-y-2.5">
              <button
                onClick={() => setConfirmStep(true)}
                disabled={!canSend}
                className="w-full flex items-center gap-3 p-4 bg-white dark:bg-[var(--color-surface)] rounded-xl border border-gray-200 dark:border-gray-600 active:scale-[0.98] transition-transform disabled:opacity-50 text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                <div className="text-left flex-1">
                  <p className="font-medium text-sm text-[var(--color-text)]">Send via SMS</p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {smsBalance > 0
                      ? `${smsBalance} credit${smsBalance !== 1 ? "s" : ""} remaining · 1 SMS per customer`
                      : "No credits available"}
                  </p>
                </div>
                <span className="text-[10px] font-semibold text-[var(--color-primary-dark)] bg-[var(--color-primary)]/5 px-2 py-1 rounded-full">
                  {smsCredits} credit{smsCredits > 1 ? "s" : ""}
                </span>
              </button>

              <button
                onClick={handleOpenWhatsApp}
                className="w-full flex items-center gap-3 p-4 bg-white dark:bg-[var(--color-surface)] rounded-xl border border-gray-200 dark:border-gray-600 active:scale-[0.98] transition-transform text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21.75c-4.556 0-8.25-3.694-8.25-8.25S7.444 5.25 12 5.25s8.25 3.694 8.25 8.25-3.694 8.25-8.25 8.25z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75a3.75 3.75 0 100 7.5 3.75 3.75 0 000-7.5z" />
                  </svg>
                </div>
                <div className="text-left flex-1">
                  <p className="font-medium text-sm text-[var(--color-text)]">Send via WhatsApp</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Open WhatsApp with payment reminder message</p>
                </div>
                <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </button>

              <button
                onClick={handleShareLink}
                disabled={sharing}
                className="w-full flex items-center gap-3 p-4 bg-white dark:bg-[var(--color-surface)] rounded-xl border border-gray-200 dark:border-gray-600 active:scale-[0.98] transition-transform disabled:opacity-50 text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                  </svg>
                </div>
                <div className="text-left flex-1">
                  <p className="font-medium text-sm text-[var(--color-text)]">Share Link</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Share via Messenger, other apps, or copy link</p>
                </div>
                {sharing && <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-600 border-t-gray-600 dark:border-t-gray-300 rounded-full animate-spin" />}
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-full mt-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl font-medium active:scale-[0.98] transition-transform"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
