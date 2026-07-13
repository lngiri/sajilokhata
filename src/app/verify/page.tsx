"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  getCreditLogByToken,
  approveByToken,
  disputeByToken,
  requestAmountEdit,
} from "@/lib/actions";

type Step = "loading" | "invalid" | "phone" | "otp" | "action" | "done";

export default function VerifyPage() {
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") || "";

  const [step, setStep] = useState<Step>("loading");
  const [log, setLog] = useState<any>(null);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
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

  useEffect(() => {
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
        checkAuth(data);
      })
      .catch(() => setStep("invalid"));
  }, [token]);

  const checkAuth = async (logData: any) => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.phone && logData?.customers?.phone) {
        const normalizedUserPhone = user.phone.replace(/^\+977/, "");
        const normalizedLogPhone = logData.customers.phone.replace(/^\+977/, "");
        if (normalizedUserPhone === normalizedLogPhone) {
          setStep("action");
          return;
        }
      }
    } catch { /* not authenticated */ }
    setStep("phone");
  };

  const handleSendOtp = async () => {
    if (!phone || phone.length < 6) {
      setMessage("कृपया मान्य फोन नम्बर प्रविष्ट गर्नुहोस् (Enter a valid phone number)");
      return;
    }
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({ phone: `+977${phone}` });
    if (error) {
      setMessage(error.message);
      return;
    }
    setStep("otp");
    setMessage("तपाईंको फोनमा OTP पठाइएको छ (OTP sent to your phone)");
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length < 4) {
      setMessage("कृपया OTP प्रविष्ट गर्नुहोस् (Enter the OTP)");
      return;
    }
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      phone: `+977${phone}`,
      token: otp,
      type: "sms",
    });
    if (error) {
      setMessage(error.message);
      return;
    }

    const normalizedPhone = phone.replace(/^\+977/, "");
    const normalizedLogPhone = (log?.customers?.phone || "").replace(/^\+977/, "");
    if (normalizedPhone === normalizedLogPhone) {
      setStep("action");
      setMessage("");
    } else {
      setMessage("यो फोन नम्बर यस कारोबारसँग सम्बन्धित छैन (Phone does not match this transaction)");
      setStep("phone");
    }
  };

  useEffect(() => {
    if (step !== "action" || !log) return;
    if (log.type !== "debit") {
      setCreditCheck(null);
      return;
    }
    const check = async () => {
      try {
        const supabase = createClient();
        const { data: mc } = await supabase
          .from("merchant_customers")
          .select("credit_limit")
          .eq("merchant_id", log.merchant_id)
          .eq("customer_id", log.customer_id)
          .maybeSingle();

        const creditLimit = (mc as any)?.credit_limit || 0;
        const { data: approvedLogs } = await supabase
          .from("credit_logs")
          .select("amount, type")
          .eq("merchant_id", log.merchant_id)
          .eq("customer_id", log.customer_id)
          .eq("status", "approved");

        const currentBalance = (approvedLogs as any[])?.reduce((sum: number, l: any) => {
          return sum + (l.type === "debit" ? l.amount : -l.amount);
        }, 0) || 0;

        const remainingLimit = creditLimit - currentBalance;
        if (log.amount > remainingLimit) {
          setCreditCheck({
            overLimit: true,
            remainingLimit,
            message: `तपाईंको उधारो सिमा (Limit) पुगिसकेको छ। बाँकी: NPR ${remainingLimit.toLocaleString()}`,
          });
        } else {
          setCreditCheck({
            overLimit: false,
            remainingLimit,
            message: `बाँकी उधारो सिमा: NPR ${remainingLimit.toLocaleString()}`,
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
      setMessage("कृपया कारण लेख्नुहोस् (Please enter a reason)");
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
      setMessage("कृपया मान्य रकम प्रविष्ट गर्नुहोस् (Enter a valid amount)");
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

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-lg p-6 space-y-5 animate-fade-in">

        {/* QR Hisab platform bar */}
        <div className="flex items-center justify-center gap-1.5 pb-3 border-b border-gray-100 mb-3">
          <div className="w-5 h-5 rounded bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] flex items-center justify-center flex-shrink-0">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-[11px] font-bold text-[var(--color-primary)] tracking-wider uppercase">QR Hisab</span>
        </div>

        {/* Bill header */}
        <div className="text-center">
          <p className="text-xs text-[var(--color-text-muted)] mb-1">
            {log?.merchants?.name || "व्यापारी"} को तर्फबाट जारी गरिएको
          </p>
          <h1 className="text-lg font-bold text-[var(--color-text)]">बिल / हिसाब</h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Verify Transaction</p>
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
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="font-medium text-[var(--color-text)]">लिंक मान्य छैन</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">Invalid or expired verification link</p>
          </div>
        )}

        {/* Phone input */}
        {step === "phone" && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-text-muted)] text-center">
              आफ्नो फोन नम्बर प्रविष्ट गर्नुहोस् (Enter your phone number to verify)
            </p>
            <div>
              <label className="text-xs font-medium text-[var(--color-text)]">Phone Number</label>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-medium text-gray-500">+977</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="98XXXXXXXX"
                  className="flex-1 px-4 py-3 bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all text-center text-lg font-mono"
                />
              </div>
            </div>
            <button
              onClick={handleSendOtp}
              className="w-full py-3 bg-[var(--color-primary)] text-white rounded-xl font-semibold active:scale-[0.98] transition-transform"
            >
              पठाउनुहोस् (Send OTP)
            </button>
          </div>
        )}

        {/* OTP input */}
        {step === "otp" && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--color-text-muted)] text-center">
              तपाईंको फोनमा पठाइएको OTP प्रविष्ट गर्नुहोस् (Enter the OTP sent to your phone)
            </p>
            <div>
              <label className="text-xs font-medium text-[var(--color-text)]">OTP Code</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="w-full mt-1 px-4 py-3 bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all text-center text-lg font-mono tracking-widest"
              />
            </div>
            <button
              onClick={handleVerifyOtp}
              className="w-full py-3 bg-[var(--color-primary)] text-white rounded-xl font-semibold active:scale-[0.98] transition-transform"
            >
              प्रमाणित गर्नुहोस् (Verify)
            </button>
            <button onClick={() => setStep("phone")}
              className="w-full text-xs text-[var(--color-text-muted)] underline active:opacity-70">
              फरक नम्बर प्रयोग गर्नुहोस् (Use different number)
            </button>
          </div>
        )}

        {/* Action (Approve/Dispute/Edit) */}
        {step === "action" && log && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-xs text-[var(--color-text-muted)]">रकम (Amount)</span>
                <span className={`font-bold ${log.type === "debit" ? "text-red-600" : "text-green-600"}`}>
                  NPR {log.amount.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-[var(--color-text-muted)]">प्रकार (Type)</span>
                <span className="text-sm font-medium">{log.type === "debit" ? "Credit Given (उधारो)" : "Payment (पैसा)"}</span>
              </div>
              {log.description && (
                <div className="flex justify-between">
                  <span className="text-xs text-[var(--color-text-muted)]">विवरण (Description)</span>
                  <span className="text-sm">{log.description}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-xs text-[var(--color-text-muted)]">ग्राहक (Customer)</span>
                <span className="text-sm">{log.customers?.name || log.customers?.phone || "—"}</span>
              </div>
            </div>

            {/* Credit limit info */}
            {creditCheck && log.type === "debit" && (
              <div className={`rounded-xl p-3 text-sm ${creditCheck.overLimit ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                {creditCheck.message}
              </div>
            )}

            {/* Edit amount input */}
            {showEditInput && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-[var(--color-text)]">
                  सही रकम (Correct Amount)
                </label>
                <input
                  type="number"
                  value={proposedAmount}
                  onChange={(e) => setProposedAmount(e.target.value.replace(/\D/g, ""))}
                  placeholder={log.amount.toString()}
                  min={1}
                  className="w-full px-4 py-3 bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all text-center text-lg font-bold"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowEditInput(false); setProposedAmount(""); }}
                    className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium active:scale-[0.98] transition-transform"
                  >
                    रद्द गर्नुहोस् (Cancel)
                  </button>
                  <button
                    onClick={handleRequestEdit}
                    disabled={submitting || !proposedAmount || parseFloat(proposedAmount) <= 0}
                    className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold active:scale-[0.98] transition-transform disabled:opacity-50"
                  >
                    {submitting ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                    ) : (
                      "पेश गर्नुहोस् (Submit)"
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Dispute reason */}
            {!showEditInput && (
              <div>
                <label className="text-xs font-medium text-[var(--color-text)]">
                  विवादको कारण (Dispute Reason) — optional
                </label>
                <textarea
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  rows={2}
                  className="w-full mt-1 px-3 py-2 bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all text-sm resize-none"
                  placeholder="e.g. Amount is incorrect"
                />
              </div>
            )}

            {!showEditInput && (
              <div className="flex gap-3">
                <button
                  onClick={() => setShowEditInput(true)}
                  disabled={submitting}
                  className="flex-1 py-3 bg-blue-50 text-blue-700 rounded-xl font-medium text-sm active:scale-[0.98] transition-transform disabled:opacity-50"
                >
                  रकम सच्याउनुहोस् (Edit Amount)
                </button>
                <button
                  onClick={handleDispute}
                  disabled={submitting}
                  className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium text-sm active:scale-[0.98] transition-transform disabled:opacity-50"
                >
                  विवाद (Dispute)
                </button>
                <button
                  onClick={handleApprove}
                  disabled={submitting || creditCheck?.overLimit}
                  className={`flex-1 py-3 rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2 ${
                    creditCheck?.overLimit ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "bg-green-600 text-white"
                  }`}
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>स्वीकृत गर्नुहोस् (Approve)</>
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
              actionDone === "approved" ? "bg-green-50" :
              actionDone === "edit_requested" ? "bg-blue-50" : "bg-amber-50"
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
              {actionDone === "approved" ? "स्वीकृत गरियो (Approved!)" :
               actionDone === "edit_requested" ? "रकम परिवर्तन अनुरोध पेश गरियो (Edit Requested!)" :
               "विवाद दर्ता गरियो (Disputed!)"}
            </p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              {actionDone === "approved"
                ? "कारोबार स्वीकृत गरिएको छ। धन्यवाद!"
                : actionDone === "edit_requested"
                ? "तपाईंको रकम परिवर्तन अनुरोध व्यापारीले समीक्षा गर्नेछ।"
                : "तपाईंको विवाद पेश गरिएको छ। व्यापारीलाई सूचित गरिनेछ।"}
            </p>
          </div>
        )}

        {/* Bottom message */}
        {message && (
          <div className={`text-center text-sm p-3 rounded-xl ${message.includes("sent") || message.includes("success") || message.includes("धन्यवाद") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
