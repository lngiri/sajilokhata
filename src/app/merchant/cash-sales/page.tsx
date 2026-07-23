"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import PullToRefresh from "@/components/PullToRefresh";
import { useToast } from "@/components/Toast";
import { getCashSales } from "@/lib/actions";
import { getCurrentMerchantId } from "@/lib/auth";

interface CashEntry {
  id: string;
  amount: number;
  quantity: number | null;
  unit: string | null;
  description: string | null;
  type: string;
  status: string;
  created_at: string;
  approved_at: string | null;
}

export default function CashSalesPage() {
  const { addToast } = useToast();
  const router = useRouter();
  const [logs, setLogs] = useState<CashEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<CashEntry | null>(null);

  const loadLogs = async () => {
    try {
      const id = await getCurrentMerchantId();
      if (id) {
        const data = await getCashSales(id, { limit: 100 });
        setLogs(data as CashEntry[]);
      }
    } catch {
      addToast("Failed to load cash sales.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleRefresh = async () => {
    await loadLogs();
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: "Asia/Kathmandu",
    });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Kathmandu",
    });
  };

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString("en-US", {
      weekday: "short",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Kathmandu",
    });
  };

  const totalCash = logs.reduce((sum, l) => sum + l.amount, 0);

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[var(--color-bg)]/80 backdrop-blur-md border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => router.back()}
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center active:scale-90 transition-transform flex-shrink-0"
          >
            <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-bold text-[var(--color-text)]">Cash Sales</h1>
            <p className="text-[10px] text-[var(--color-text-muted)]">
              {logs.length} {logs.length === 1 ? "transaction" : "transactions"} &middot; Total Rs. {totalCash.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-blue-500 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="font-medium text-[var(--color-text)]">No cash sales yet</p>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Cash sales will appear here once recorded via Manual Entry.
          </p>
          <button
            onClick={() => router.push("/merchant/scan?manual=true")}
            className="mt-4 px-6 py-2.5 bg-[var(--color-primary)] text-white rounded-xl text-sm font-medium active:scale-[0.98] transition-transform"
          >
            Record a Cash Sale
          </button>
        </div>
      ) : (
        <PullToRefresh onRefresh={handleRefresh}>
          <div className="px-4 py-4 space-y-2">
            {logs.map((log) => (
              <button
                key={log.id}
                onClick={() => setSelectedLog(log)}
                className="w-full text-left bg-[var(--color-surface)] rounded-xl p-4 shadow-sm border border-[var(--color-border)] active:scale-[0.98] transition-transform flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-[var(--color-text)] truncate">
                    {log.description || "Cash Sale"}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                    {formatDate(log.created_at)} &middot; {formatTime(log.created_at)}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-sm text-blue-600 dark:text-blue-400">
                    Rs. {log.amount.toLocaleString()}
                  </p>
                  {log.quantity && (
                    <p className="text-[10px] text-[var(--color-text-muted)]">
                      {log.quantity} {log.unit || "units"}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </PullToRefresh>
      )}

      {/* Detail Modal */}
      {selectedLog && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedLog(null); }}
        >
          <div className="w-full max-w-md bg-[var(--color-surface)] rounded-t-3xl sm:rounded-3xl animate-slide-up p-6 max-h-[90dvh] overflow-y-auto">
            {/* Handle + Close */}
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg text-[var(--color-text)]">Receipt Detail</h2>
              <button
                onClick={() => setSelectedLog(null)}
                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center active:scale-90 transition-transform"
              >
                <svg className="w-4 h-4 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Receipt Card */}
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-5 space-y-4 border border-[var(--color-border)]">
              {/* Header */}
              <div className="text-center pb-3 border-b border-[var(--color-border)]">
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center mx-auto mb-2">
                  <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="font-bold text-lg text-[var(--color-text)]">Cash Sale</p>
                <p className="text-xs text-[var(--color-text-muted)]">Transaction #{selectedLog.id.slice(0, 8)}</p>
              </div>

              {/* Items / Description */}
              {selectedLog.description && (
                <div>
                  <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">Items</p>
                  <div className="bg-[var(--color-surface)] rounded-xl p-3 border border-[var(--color-border)]">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-[var(--color-text)]">
                          {selectedLog.description}
                        </p>
                        {selectedLog.quantity && (
                          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                            Qty: {selectedLog.quantity} {selectedLog.unit || "units"}
                          </p>
                        )}
                      </div>
                      <p className="font-bold text-sm text-blue-600 dark:text-blue-400 flex-shrink-0 ml-3">
                        Rs. {selectedLog.amount.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Totals */}
              <div className="bg-[var(--color-surface)] rounded-xl p-3 border border-[var(--color-border)] space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--color-text-muted)]">Subtotal</span>
                  <span className="font-medium text-[var(--color-text)]">Rs. {selectedLog.amount.toLocaleString()}</span>
                </div>
                <div className="border-t border-[var(--color-border)] pt-1.5 flex items-center justify-between">
                  <span className="font-semibold text-[var(--color-text)]">Total</span>
                  <span className="font-bold text-lg text-blue-600 dark:text-blue-400">Rs. {selectedLog.amount.toLocaleString()}</span>
                </div>
              </div>

              {/* Timestamps */}
              <div className="space-y-1 text-xs text-[var(--color-text-muted)]">
                <div className="flex items-center justify-between">
                  <span>Created</span>
                  <span className="font-medium text-[var(--color-text)]">{formatDateTime(selectedLog.created_at)}</span>
                </div>
                {selectedLog.approved_at && (
                  <div className="flex items-center justify-between">
                    <span>Received</span>
                    <span className="font-medium text-green-600 dark:text-green-400">{formatDateTime(selectedLog.approved_at)}</span>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setSelectedLog(null)}
              className="w-full mt-5 py-3.5 bg-[var(--color-primary)] text-white rounded-xl font-semibold active:scale-[0.98] transition-transform"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
