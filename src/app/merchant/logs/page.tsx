"use client";

import { useState, useEffect } from "react";
import BottomNav from "@/components/BottomNav";
import PullToRefresh from "@/components/PullToRefresh";
import PendingApprovalModal from "@/components/PendingApprovalModal";
import { useToast } from "@/components/Toast";
import { playSuccessSound } from "@/lib/sound";
import TransactionIcon from "@/components/TransactionIcon";
import { getMerchantCreditLogs, updateCreditLogStatus } from "@/lib/actions";
import { getCurrentMerchantId } from "@/lib/auth";

interface LogEntry {
  id: string;
  amount: number;
  type: "debit" | "credit" | "cash";
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
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [pendingEntries, setPendingEntries] = useState<{ id: string; customerName: string; amount: number; description: string | null }[]>([]);

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

  const refreshAndCheckPending = async () => {
    try {
      const id = await getCurrentMerchantId();
      if (id) {
        const allLogs = await getMerchantCreditLogs(id, { limit: 50 });
        const pending = (allLogs as LogEntry[]).filter((l) => l.status === "pending");
        setLogs(allLogs as LogEntry[]);
        if (pending.length > 0) {
          setPendingEntries(
            pending.map((l) => ({
              id: l.id,
              customerName: l.customers?.name || l.customers?.phone || "Unknown",
              amount: l.amount,
              description: l.description,
            }))
          );
          setShowApprovalModal(true);
        }
      }
    } catch {
      addToast("Failed to refresh.", "error");
    }
  };

  const openApprovalModal = () => {
    const pending = logs.filter((l) => l.status === "pending");
    if (pending.length === 0) {
      addToast("No pending entries.", "info");
      return;
    }
    setPendingEntries(
      pending.map((l) => ({
        id: l.id,
        customerName: l.customers?.name || l.customers?.phone || "Unknown",
        amount: l.amount,
        description: l.description,
      }))
    );
    setShowApprovalModal(true);
  };

  const handleApprove = async (logId: string) => {
    setLogs((prev) => prev.filter((l) => l.id !== logId));
    try {
      await updateCreditLogStatus(logId, "approved");
      playSuccessSound();
      addToast("Entry approved!", "success", {
        label: "Undo",
        onClick: async () => {
          await updateCreditLogStatus(logId, "pending");
          loadLogs();
        },
      });
    } catch (e: any) {
      addToast(e?.message || "Failed to approve entry. Please try again.", "error");
      loadLogs();
    }
  };

  const handleReject = async (logId: string) => {
    setLogs((prev) => prev.filter((l) => l.id !== logId));
    try {
      await updateCreditLogStatus(logId, "rejected");
      addToast("Entry rejected.", "warning");
    } catch {
      addToast("Failed to reject entry. Please try again.", "error");
      loadLogs();
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "text-green-600 bg-green-50";
      case "pending":
      case "unverified":
        return "text-amber-600 bg-amber-50";
      case "rejected":
        return "text-slate-500 bg-slate-100";
      case "disputed":
        return "text-[var(--color-danger)] bg-[var(--color-danger)]/10";
      default:
        return "text-gray-500 bg-gray-100";
    }
  };

  const pendingCount = logs.filter((l) => l.status === "pending").length;

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

      {pendingCount > 0 && !loading && (
        <button
          onClick={openApprovalModal}
          className="w-full flex items-center gap-2 px-4 py-3 bg-amber-50 border-b border-amber-100 active:bg-amber-100 transition-colors"
        >
          <div className="w-6 h-6 rounded-full bg-amber-200 flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-sm font-medium text-amber-800 flex-1 text-left">
            {pendingCount} {pendingCount === 1 ? "entry" : "entries"} pending approval
          </span>
          <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      )}

      <PullToRefresh onRefresh={refreshAndCheckPending}>
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
              <p className="text-sm mt-1">Start by scanning a customer's QR or ask them to scan yours</p>
              <div className="flex gap-3 justify-center mt-4">
                <a
                  href="/merchant/scan"
                  className="px-5 py-2.5 bg-[var(--color-primary)] text-white rounded-xl text-sm font-medium active:scale-[0.98] transition-transform inline-flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM6.75 6.75h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
                  </svg>
                  Scan Customer
                </a>
                <a
                  href="/merchant/settings"
                  className="px-5 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm font-medium active:scale-[0.98] transition-transform inline-flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                  </svg>
                  Settings
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div key={log.id} className={`bg-white rounded-xl p-4 shadow-sm border border-gray-50 ${log.status === "rejected" ? "opacity-60" : ""}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${log.type === "debit" ? "bg-red-50" : log.type === "cash" ? "bg-blue-50" : "bg-green-50"}`}>
                      <TransactionIcon type={log.type} size={16} className={log.type === "debit" ? "text-red-600" : log.type === "cash" ? "text-blue-600" : "text-green-600"} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm text-[var(--color-text)] truncate">
                          {log.type === "cash" ? "Cash Sale" : (log.customers?.name || log.customers?.phone || "Unknown")}
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
                      <p className={`font-bold text-sm ${log.status === "rejected" ? "text-slate-400 line-through" : log.type === "debit" ? "text-red-600" : log.type === "cash" ? "text-blue-600" : "text-green-600"}`}>
                        {log.type === "cash" ? "" : (log.type === "debit" ? "+" : "-")}Rs. {log.amount.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">
                        {new Date(log.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "Asia/Kathmandu" })}
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
      </PullToRefresh>

      <BottomNav />

      <PendingApprovalModal
        show={showApprovalModal}
        mode="merchant"
        entries={pendingEntries}
        onApprove={async (id) => {
          setPendingEntries((prev) => prev.filter((e) => e.id !== id));
          setLogs((prev) => prev.filter((l) => l.id !== id));
          await updateCreditLogStatus(id, "approved").then(
            () => {
              playSuccessSound();
              addToast("Entry approved!", "success", {
                label: "Undo",
                onClick: async () => {
                  await updateCreditLogStatus(id, "pending");
                  loadLogs();
                },
              });
            },
            (e: any) => { addToast(e?.message || "Failed to approve entry. Please try again.", "error"); loadLogs(); }
          );
        }}
        onReject={async (id) => {
          setPendingEntries((prev) => prev.filter((e) => e.id !== id));
          setLogs((prev) => prev.filter((l) => l.id !== id));
          await updateCreditLogStatus(id, "rejected").then(
            () => addToast("Entry rejected.", "warning"),
            () => { addToast("Failed to reject entry. Please try again.", "error"); loadLogs(); }
          );
        }}
        onClose={() => {
          setShowApprovalModal(false);
          loadLogs();
        }}
      />
    </div>
  );
}
