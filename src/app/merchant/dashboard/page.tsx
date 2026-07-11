"use client";

import { useState, useEffect } from "react";
import BottomNav from "@/components/BottomNav";
import NetworkStatus from "@/components/NetworkStatus";
import OfflineIndicator from "@/components/OfflineIndicator";
import { getMerchantStats, getMerchantCreditLogs } from "@/lib/actions";
import { getCurrentMerchantId } from "@/lib/auth";

export default function MerchantDashboard() {
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    totalOutstanding: number;
    totalCreditLimit: number;
    customerCount: number;
    pendingCount: number;
    todayTotal: number;
  } | null>(null);
  const [pendingLogs, setPendingLogs] = useState<
    {
      id: string;
      amount: number;
      type: string;
      description: string | null;
      created_at: string;
      customers: { name: string | null; phone: string } | null;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const id = await getCurrentMerchantId();
      setMerchantId(id);

      if (id) {
        const [statsData, logsData] = await Promise.all([
          getMerchantStats(id),
          getMerchantCreditLogs(id, { status: "pending", limit: 10 }),
        ]);
        setStats(statsData);
        setPendingLogs(logsData as typeof pendingLogs);
      }
    } catch {
      // Empty state - no data yet
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pb-20">
      <NetworkStatus />

      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-bold text-[var(--color-text)]">
              Sajilo Khata
            </h1>
            <p className="text-xs text-[var(--color-text-muted)]">
              Digital Diary
            </p>
          </div>
          <OfflineIndicator />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="px-4 py-4 space-y-4">
          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50">
                <p className="text-xs text-[var(--color-text-muted)] mb-1">
                  Outstanding
                </p>
                <p className="text-xl font-bold text-[var(--color-danger)]">
                  NPR {stats.totalOutstanding.toLocaleString()}
                </p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50">
                <p className="text-xs text-[var(--color-text-muted)] mb-1">
                  Today
                </p>
                <p className="text-xl font-bold text-[var(--color-primary)]">
                  NPR {stats.todayTotal.toLocaleString()}
                </p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50">
                <p className="text-xs text-[var(--color-text-muted)] mb-1">
                  Customers
                </p>
                <p className="text-xl font-bold text-[var(--color-text)]">
                  {stats.customerCount}
                </p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50 relative overflow-hidden">
                <p className="text-xs text-[var(--color-text-muted)] mb-1">
                  Pending
                </p>
                <p className="text-xl font-bold text-[var(--color-accent)]">
                  {stats.pendingCount}
                </p>
                {stats.pendingCount > 0 && (
                  <div className="absolute top-2 right-2 w-2 h-2 bg-[var(--color-accent)] rounded-full animate-pulse-soft" />
                )}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex gap-3">
            <a
              href="/merchant/scan"
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-[var(--color-primary)] text-white rounded-xl font-medium text-sm active:scale-[0.98] transition-transform"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
              </svg>
              Scan QR
            </a>
            <a
              href="/merchant/qr"
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-white text-[var(--color-text)] border border-gray-200 rounded-xl font-medium text-sm active:scale-[0.98] transition-transform"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
              </svg>
              Show QR
            </a>
            <a
              href="/merchant/logs"
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-white text-[var(--color-text)] border border-gray-200 rounded-xl font-medium text-sm active:scale-[0.98] transition-transform"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Ledger
            </a>
          </div>

          {/* Pending Approvals */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-[var(--color-text)]">
                Pending Approvals
              </h2>
              {pendingLogs.length > 0 && (
                <span className="px-2 py-0.5 bg-[var(--color-accent)]/10 text-[var(--color-accent)] text-xs font-medium rounded-full">
                  {pendingLogs.length}
                </span>
              )}
            </div>

            {pendingLogs.length === 0 ? (
              <div className="text-center py-8 text-[var(--color-text-muted)]">
                <svg className="w-12 h-12 mx-auto mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                </svg>
                <p className="text-sm">No pending entries</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingLogs.map((log) => (
                  <div
                    key={log.id}
                    className="bg-white rounded-xl p-4 shadow-sm border border-gray-50 flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-bold text-[var(--color-accent)]">
                        {log.type === "debit" ? "+" : "-"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-[var(--color-text)] truncate">
                        {log.customers?.name || log.customers?.phone || "Unknown"}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)] truncate">
                        {log.description || "No description"}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-[var(--color-text)]">
                        NPR {log.amount.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">
                        {new Date(log.created_at).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
