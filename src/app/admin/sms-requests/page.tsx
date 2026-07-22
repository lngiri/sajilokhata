"use client";

import { useEffect, useState } from "react";
import {
  getPendingSmsRequests,
  approveSmsRequest,
  rejectSmsRequest,
  type SmsRequestRecord,
} from "@/app/actions/sms-billing";

export default function SmsRequestsPage() {
  const [requests, setRequests] = useState<SmsRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const result = await getPendingSmsRequests();
    if (result.success && result.requests) setRequests(result.requests);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleApprove = async (id: string) => {
    setProcessing(id);
    const result = await approveSmsRequest(id);
    if (result.success) {
      setRequests((prev) => prev.filter((r) => r.id !== id));
    }
    setProcessing(null);
  };

  const handleReject = async (id: string) => {
    setProcessing(id);
    const result = await rejectSmsRequest(id);
    if (result.success) {
      setRequests((prev) => prev.filter((r) => r.id !== id));
    }
    setProcessing(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--a-text)] tracking-tight mb-1">SMS Requests</h1>
          <p className="text-sm text-[var(--a-muted)]">Verify manual payment screenshots and grant SMS credits</p>
        </div>
        <button onClick={load} className="text-xs text-[var(--a-muted)] hover:text-[var(--a-text)] px-3 py-1.5 rounded-lg hover:bg-[var(--a-hover)] transition-colors">
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16 text-[var(--a-muted)]">
          <svg className="w-14 h-14 mx-auto mb-4 text-[var(--a-muted)] opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium">No pending SMS requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div key={req.id} className="rounded-xl border border-[var(--a-border)] bg-[var(--a-surface-2)]/50 shadow-lg p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-semibold text-sm text-[var(--a-text)] truncate">
                      {req.merchants?.business_name || req.merchants?.name || "Unknown"}
                    </span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-800/30">
                      Pending
                    </span>
                  </div>
                  <p className="text-xs text-[var(--a-muted)] mb-2">
                    {req.merchants?.phone && `${req.merchants.phone} · `}
                    Rs. {Number(req.amount).toLocaleString()} &middot; {req.sms_count} SMS
                  </p>
                  {req.transaction_id && (
                    <p className="text-xs text-[var(--a-text-2)] mb-1">
                      <span className="text-[var(--a-muted)]">Txn ID:</span> {req.transaction_id}
                    </p>
                  )}
                  <p className="text-[10px] text-[var(--a-muted)]">
                    {new Date(req.created_at).toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {req.screenshot_url && (
                    <a
                      href={req.screenshot_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      View
                    </a>
                  )}
                  <button
                    onClick={() => handleApprove(req.id)}
                    disabled={processing === req.id}
                    className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-light)] disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    {processing === req.id ? (
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : "Approve"}
                  </button>
                  <button
                    onClick={() => handleReject(req.id)}
                    disabled={processing === req.id}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
