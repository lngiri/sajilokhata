"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  getCreditLogByToken,
  approveByToken,
  disputeByToken,
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
  const [actionDone, setActionDone] = useState<"approved" | "disputed" | null>(null);

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

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-lg p-6 space-y-5 animate-fade-in">

        {/* Header */}
        <div className="text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-[var(--color-primary)]/10 flex items-center justify-center">
            <svg className="w-7 h-7 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-[var(--color-text)]">कारोबार प्रमाणित गर्नुहोस्</h1>
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

        {/* Action (Approve/Dispute) */}
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

            {/* Dispute reason */}
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

            <div className="flex gap-3">
              <button
                onClick={handleDispute}
                disabled={submitting}
                className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                विवाद (Dispute)
              </button>
              <button
                onClick={handleApprove}
                disabled={submitting}
                className="flex-1 py-3 bg-green-600 text-white rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>स्वीकृत गर्नुहोस् (Approve)</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Done */}
        {step === "done" && (
          <div className="text-center py-6">
            <div className={`w-14 h-14 mx-auto mb-3 rounded-full flex items-center justify-center ${actionDone === "approved" ? "bg-green-50" : "bg-amber-50"}`}>
              {actionDone === "approved" ? (
                <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : (
                <svg className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              )}
            </div>
            <p className="font-bold text-[var(--color-text)]">
              {actionDone === "approved" ? "स्वीकृत गरियो (Approved!)" : "विवाद दर्ता गरियो (Disputed!)"}
            </p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              {actionDone === "approved"
                ? "कारोबार स्वीकृत गरिएको छ। धन्यवाद!"
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
