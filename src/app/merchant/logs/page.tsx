"use client";

import { useState, useEffect } from "react";
import BottomNav from "@/components/BottomNav";
import { useToast } from "@/components/Toast";
import { getMerchantCreditLogs, updateCreditLogStatus } from "@/lib/actions";
import { getCurrentMerchantId } from "@/lib/auth";

interface LogEntry {
  id: string;
  amount: number;
  type: string;
  status: string;
  description: string | null;
  quantity: number | null;
  unit: string | null;
  created_at: string;
  customers: { name: string | null; phone: string } | null;
}

export default function LedgerPage() {
  const { addToast } = useToast();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "disputed">("all");

  useEffect(() => {
    loadLogs();
  }, [filter]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const id = await getCurrentMerchantId();
      if (id) {
        const data = await getMerchantCreditLogs(id, {
          status: filter === "all" ? undefined : filter,
          limit: 50,
        });
        setLogs(data as LogEntry[]);
      }
    } catch {
      addToast("Failed to load ledger entries.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (logId: string) => {
    try {
      await updateCreditLogStatus(logId, "approved");
      loadLogs();
    } catch {
      addToast("Failed to approve entry. Please try again.", "error");
    }
  };

  const handleReject = async (logId: string) => {
    try {
      await updateCreditLogStatus(logId, "rejected");
      loadLogs();
    } catch {
      addToast("Failed to reject entry. Please try again.", "error");
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "text-[var(--color-primary)] bg-[var(--color-primary)]/10";
      case "pending":
        return "text-[var(--color-accent)] bg-[var(--color-accent)]/10";
      case "disputed":
        return "text-[var(--color-danger)] bg-[var(--color-danger)]/10";
      default:
        return "text-gray-500 bg-gray-100";
    }
  };

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center px-4 py-3">
          <a href="/merchant/dashboard" className="mr-3 p-1 active:scale-95 transition-transform">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </a>
          <h1 className="text-lg font-bold text-[var(--color-text)]">Ledger</h1>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 px-4 pb-3 overflow-x-auto">
          {(["all", "pending", "approved", "disputed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize whitespace-nowrap transition-colors ${
                filter === f
                  ? "bg-[var(--color-primary)] text-white"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-[var(--color-text-muted)]">
            <svg className="w-16 h-16 mx-auto mb-3 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
            <p className="font-medium">No entries found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-50">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${statusColor(log.status)}`}>
                    <span className="text-lg font-bold">{log.type === "debit" ? "+" : "-"}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm text-[var(--color-text)] truncate">
                        {log.customers?.name || log.customers?.phone || "Unknown"}
                      </p>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${statusColor(log.status)}`}>
                        {log.status}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">{log.description || "No description"}</p>
                    {log.quantity && (
                      <p className="text-xs text-[var(--color-text-muted)]">{log.quantity} {log.unit}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`font-bold text-sm ${log.type === "debit" ? "text-[var(--color-danger)]" : "text-[var(--color-primary)]"}`}>
                      {log.type === "debit" ? "+" : "-"}NPR {log.amount.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-muted)]">
                      {new Date(log.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                </div>

                {log.status === "pending" && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
                    <button
                      onClick={() => handleReject(log.id)}
                      className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium active:scale-[0.98]"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleApprove(log.id)}
                      className="flex-1 py-2 bg-[var(--color-primary)] text-white rounded-lg text-xs font-medium active:scale-[0.98]"
                    >
                      Approve
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
