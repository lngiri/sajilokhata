"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  getCreditLogByToken,
  approveByToken,
  disputeByToken,
  requestAmountEdit,
} from "@/lib/actions";
import CustomerOnboardingModal from "@/components/CustomerOnboardingModal";
import LogoWithAbout from "@/components/LogoWithAbout";

type Step = "loading" | "invalid" | "action" | "onboard" | "done";

export default function VerifyPage() {
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") || "";

  const [step, setStep] = useState<Step>("loading");
  const [log, setLog] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionDone, setActionDone] = useState<"approved" | "disputed" | "edit_requested" | null>(null);
  const [creditCheck, setCreditCheck] = useState<{
    overLimit: boolean;
    remainingLimit: number;
    message: string;
  } | null>(null);
  const [showEditInput, setShowEditInput] = useState(false);
  const [proposedAmount, setProposedAmount] = useState("");
  const onboardedRef = useRef(false);

  useEffect(() => {
    if (onboardedRef.current) return;
    if (!token) {
      setStep("invalid");
      return;
    }
    getCreditLogByToken(token)
      .then((data) => {
        if (!data || data.status !== "unverified") {
          setStep("invalid");
          return;
        }
        setLog(data);
        onboardedRef.current = true;
        if (!data.customers?.name || !data.customers?.address) {
          setStep("onboard");
        } else {
          setStep("action");
        }
      })
      .catch(() => setStep("invalid"));
  }, [token]);

  useEffect(() => {
    if (step !== "action" || !log) return;
    if (log.type !== "debit") {
      setCreditCheck(null);
      return;
    }
    const check = async () => {
      try {
        const { getMerchantCustomerBalance } = await import("@/app/actions/merchant");
        const { balance, creditLimit } = await getMerchantCustomerBalance(log.merchant_id, log.customer_id);

        const remainingLimit = creditLimit - balance;
        if (log.amount > remainingLimit) {
          setCreditCheck({
            overLimit: true,
            remainingLimit,
            message: `Credit limit exceeded. Remaining: Rs. ${remainingLimit.toLocaleString()}`,
          });
        } else {
          setCreditCheck({
            overLimit: false,
            remainingLimit,
            message: `Remaining credit limit: Rs. ${remainingLimit.toLocaleString()}`,
          });
        }
      } catch {
        setCreditCheck(null);
      }
    };
    check();
  }, [step, log]);

  const handleApprove = async () => {
    setSubmitting(true);
    setMessage("");
    try {
      await approveByToken(token);
      setActionDone("approved");
      setStep("done");
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDispute = async () => {
    if (!disputeReason.trim()) {
      setMessage("Please enter a reason");
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      await disputeByToken(token, disputeReason);
      setActionDone("disputed");
      setStep("done");
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestEdit = async () => {
    const amt = parseFloat(proposedAmount);
    if (!amt || amt <= 0) {
      setMessage("Please enter a valid amount");
      return;
    }
    setSubmitting(true);
    setMessage("");
    try {
      await requestAmountEdit(token, amt);
      setActionDone("edit_requested");
      setStep("done");
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoToDashboard = () => {
    if (log?.customers?.phone) {
      const session = JSON.stringify({
        phone: log.customers.phone,
        name: log.customers.name || "",
      });
      localStorage.setItem("sajilo_customer_session", session);
      document.cookie = `customer_session=${encodeURIComponent(session)}; path=/; max-age=${365 * 24 * 60 * 60}; SameSite=Lax`;
    }
    window.location.replace("/customer/dashboard");
  };

  const handleCustomerOnboarded = () => {
    onboardedRef.current = true;
    setStep("action");
  };

  return (
    <>
      {step === "onboard" && log?.customers?.phone && (
        <CustomerOnboardingModal
          phone={log.customers.phone}
          onComplete={handleCustomerOnboarded}
        />
      )}
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[var(--color-surface)] rounded-3xl shadow-lg p-6 space-y-5 animate-fade-in">

        {/* QR Hisab platform bar with logo draw animation */}
        <div className="flex items-center justify-center gap-2 pb-3 border-b border-[var(--color-border)] mb-3">
          <LogoWithAbout size={24} showAnimation />
          <span className="text-[11px] font-bold text-[var(--color-primary)] tracking-wider uppercase">QR Hisab ✨</span>
        </div>

        {/* Bill header */}
        <div className="text-center">
          <p className="text-xs text-[var(--color-text-muted)] mb-1">
            Issued by {log?.merchants?.name || "Merchant"}
          </p>
          <h1 className="text-lg font-bold text-[var(--color-text)]">Verify Entry ✅</h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Review and confirm this transaction</p>
        </div>

        {/* Loading */}
        {step === "loading" && (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Invalid */}
        {step === "invalid" && (
          <div className="text-center py-6">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="font-medium text-[var(--color-text)]">Oops! Link expired 😅</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">This verification link is invalid or has expired. Ask the merchant to send a new one.</p>
          </div>
        )}

        {/* Action (Approve/Dispute/Edit) — shown immediately with token */}
        {step === "action" && log && (
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-[var(--color-text-muted)]">Amount</span>
                <span className={`font-bold ${log.type === "debit" ? "text-red-600" : "text-green-600"}`}>
                  Rs. {log.amount.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-[var(--color-text-muted)]">Type</span>
                <span className="text-sm font-medium">{log.type === "debit" ? "Credit Given" : "Payment"}</span>
              </div>
              {log.description && (
                <div className="flex justify-between">
                  <span className="text-xs text-[var(--color-text-muted)]">Description</span>
                  <span className="text-sm">{log.description}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-xs text-[var(--color-text-muted)]">Customer</span>
                <span className="text-sm">{log.customers?.name || log.customers?.phone || "—"}</span>
              </div>
            </div>

            {/* Credit limit info */}
            {creditCheck && log.type === "debit" && (
              <div className={`rounded-xl p-3 text-sm ${creditCheck.overLimit ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400" : "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"}`}>
                {creditCheck.message}
              </div>
            )}

            {/* Edit amount input */}
            {showEditInput && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-[var(--color-text)]">
                  Correct Amount
                </label>
                <input
                  type="number"
                  value={proposedAmount}
                  onChange={(e) => setProposedAmount(e.target.value.replace(/\D/g, ""))}
                  placeholder={log.amount.toString()}
                  min={1}
                  className="w-full px-4 py-3 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all text-center text-lg font-bold"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowEditInput(false); setProposedAmount(""); }}
                    className="flex-1 py-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-medium active:scale-[0.98] transition-transform"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRequestEdit}
                    disabled={submitting || !proposedAmount || parseFloat(proposedAmount) <= 0}
                    className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold active:scale-[0.98] transition-transform disabled:opacity-50"
                  >
                    {submitting ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                    ) : (
                      "Submit"
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Dispute reason */}
            {!showEditInput && (
              <div>
                <label className="text-xs font-medium text-[var(--color-text)]">
                  Dispute Reason — optional
                </label>
                <textarea
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  rows={2}
                  className="w-full mt-1 px-3 py-2 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all text-sm resize-none"
                  placeholder="e.g. Amount is incorrect"
                />
              </div>
            )}

            {!showEditInput && (
              <div className="flex gap-3">
                <button
                  onClick={() => setShowEditInput(true)}
                  disabled={submitting}
                  className="flex-1 py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-xl font-medium text-sm active:scale-[0.98] transition-transform disabled:opacity-50"
                >
                  Edit Amount
                </button>
                <button
                  onClick={handleDispute}
                  disabled={submitting}
                  className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl font-medium text-sm active:scale-[0.98] transition-transform disabled:opacity-50"
                >
                  Dispute
                </button>
                <button
                  onClick={handleApprove}
                  disabled={submitting || creditCheck?.overLimit}
                  className={`flex-1 py-3 rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2 ${
                    creditCheck?.overLimit ? "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed" : "bg-green-600 text-white"
                  }`}
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>Approve</>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Done */}
        {step === "done" && (
          <div className="text-center py-6">
            <div className={`w-14 h-14 mx-auto mb-3 rounded-full flex items-center justify-center ${
              actionDone === "approved" ? "bg-green-50 dark:bg-green-900/20" :
              actionDone === "edit_requested" ? "bg-blue-50 dark:bg-blue-900/20" : "bg-amber-50 dark:bg-amber-900/20"
            }`}>
              {actionDone === "approved" ? (
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : actionDone === "edit_requested" ? (
                <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
              ) : (
                <svg className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              )}
            </div>
            <p className="font-bold text-[var(--color-text)]">
              {actionDone === "approved" ? "All good! 🎉" :
               actionDone === "edit_requested" ? "Edit Requested! ✏️" :
               "Disputed! ⚠️"}
            </p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              {actionDone === "approved"
                ? "Transaction approved! Thank you ❤️"
                : actionDone === "edit_requested"
                ? "Your amount edit request has been submitted. The merchant will review it."
                : "Your dispute has been submitted. The merchant will be notified."}
            </p>
            <button
              onClick={handleGoToDashboard}
              className="w-full mt-4 py-3 bg-[var(--color-primary)] text-white rounded-xl font-semibold active:scale-[0.98] transition-transform"
            >
              Go to Dashboard
            </button>
          </div>
        )}

        {/* Bottom message */}
        {message && (
          <div className={`text-center text-sm p-3 rounded-xl ${message.includes("sent") || message.includes("success") || message.includes("approved") || message.includes("Dev mode") ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400" : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"}`}>
            {message}
          </div>
        )}
      </div>
    </div>
    </>
  );
}
