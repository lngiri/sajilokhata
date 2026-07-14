"use client";

import { useState, useEffect } from "react";
import CustomerBottomNav from "@/components/CustomerBottomNav";
import PullToRefresh from "@/components/PullToRefresh";
import { useToast } from "@/components/Toast";
import { getCustomerCreditLogs, updateCreditLog, cancelCreditLog, confirmCustomerEntry, disputeEntry } from "@/lib/actions";
import TransactionIcon from "@/components/TransactionIcon";
import { useSearchParams } from "next/navigation";
import { signOut } from "@/lib/auth";

/** Key used to persist customer session in localStorage */
const CUSTOMER_STORAGE_KEY = "sajilo_customer_session";

interface HistoryEntry {
  id: string;
  amount: number;
  type: "debit" | "credit";
  status: string;
  description: string | null;
  created_at: string;
  approved_at: string | null;
  merchants: {
    id: string;
    name: string;
    business_name: string | null;
  } | null;
  customers: {
    name: string | null;
    phone: string;
  } | null;
}

const statusConfig = {
  pending: { bg: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  unverified: { bg: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  approved: { bg: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-500" },
  rejected: { bg: "bg-slate-50 text-slate-500 border-slate-200", dot: "bg-slate-400" },
  disputed: { bg: "bg-purple-50 text-purple-700 border-purple-200", dot: "bg-purple-500" },
} as const;

function getStatusConfig(status: string) {
  return statusConfig[status as keyof typeof statusConfig] || {
    bg: "bg-gray-50 text-gray-600 border-gray-200",
    dot: "bg-gray-400",
  };
}

export default function CustomerHistoryPage() {
  const { addToast } = useToast();
  const searchParams = useSearchParams();
  const merchantIdParam = searchParams?.get("merchantId") || "";
  const shopNameParam = searchParams?.get("shopName") || "";
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [logs, setLogs] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unverified" | "pending" | "approved" | "rejected">("all");
  const [stats, setStats] = useState({ total: 0, pending: 0, unverified: 0, approved: 0, rejected: 0 });
  const [editModal, setEditModal] = useState<{ id: string; amount: number; description: string } | null>(null);

  // On mount, restore customer session
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CUSTOMER_STORAGE_KEY);
      if (raw) {
        const session = JSON.parse(raw);
        if (session.phone) {
          setCustomerPhone(session.phone);
        }
      }
    } catch {
      // Ignore
    } finally {
      setInitialized(true);
    }
  }, []);

  // Redirect to /scan if no session
  useEffect(() => {
    if (initialized && !customerPhone) {
      window.location.href = "/scan";
    }
  }, [initialized, customerPhone]);

  // Load logs
  useEffect(() => {
    if (customerPhone) {
      loadLogs();
    }
  }, [customerPhone, filter, merchantIdParam]);

  const loadLogs = async () => {
    if (!customerPhone) return;
    setLoading(true);
    try {
      const data = await getCustomerCreditLogs(customerPhone, {
        status: filter === "all" ? undefined : filter,
        merchant_id: merchantIdParam || undefined,
        limit: 100,
      });
      setLogs(data as HistoryEntry[]);

      // Calculate status counts
      const counts = { total: data.length, pending: 0, unverified: 0, approved: 0, rejected: 0 };
      data.forEach((l: HistoryEntry) => {
        if (l.status === "pending") counts.pending++;
        else if (l.status === "unverified") counts.unverified++;
        else if (l.status === "approved") counts.approved++;
        else if (l.status === "rejected") counts.rejected++;
      });
      setStats(counts);
    } catch {
      addToast("Failed to load transaction history.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Handle clear session — removes localStorage, cookies, SW caches
  const handleSignOut = () => {
    signOut();
  };

  // Prevent flash while checking localStorage
  if (!initialized) {
    return (
      <div className="min-h-dvh bg-[var(--color-bg)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[var(--color-bg)] pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center">
            <a href="/customer/dashboard" className="mr-3 p-1 active:scale-95 transition-transform">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </a>
            <h1 className="text-lg font-bold text-[var(--color-text)]">
              {shopNameParam ? `${shopNameParam} History` : "Transaction History"}
            </h1>
          </div>
          <button
            onClick={handleSignOut}
            className="text-xs text-[var(--color-text-muted)] px-2.5 py-1.5 rounded-lg hover:bg-gray-100 active:scale-95 transition-all"
          >
            Sign Out
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto">
          {([
            { key: "all", label: "All", count: stats.total },
            { key: "unverified", label: "Unverified", count: stats.unverified },
            { key: "pending", label: "Pending", count: stats.pending },
            { key: "approved", label: "Approved", count: stats.approved },
            { key: "rejected", label: "Rejected", count: stats.rejected },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium capitalize whitespace-nowrap transition-all ${
                filter === tab.key
                  ? "bg-[var(--color-primary)] text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  filter === tab.key ? "bg-white/20" : "bg-gray-200 text-gray-500"
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Pending / Unverified banner */}
      {!loading && (stats.pending > 0 || stats.unverified > 0) && (
        <a
          href="/customer/dashboard"
          className="flex items-center gap-2 px-4 py-3 bg-amber-50 border-b border-amber-100 active:bg-amber-100 transition-colors"
        >
          <div className="w-6 h-6 rounded-full bg-amber-200 flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-sm font-medium text-amber-800 flex-1 text-left">
            {stats.pending > 0 && `${stats.pending} pending`}
            {stats.pending > 0 && stats.unverified > 0 && " · "}
            {stats.unverified > 0 && `${stats.unverified} unverified`}
            {' — review needed'}
          </span>
          <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </a>
      )}

      {/* Content */}
      <PullToRefresh onRefresh={loadLogs}>
        <div className="px-4 py-4">
          {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-50 flex items-center justify-center">
              <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="font-medium text-[var(--color-text-muted)]">
              {filter === "all" ? "No transactions yet" : `No ${filter} transactions`}
            </p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              {filter === "all"
                ? "Scan a shop QR or search by phone to get started."
                : `You have no ${filter} credit requests.`}
            </p>
            <div className="flex gap-3 justify-center mt-4">
              <a
                href="/customer/dashboard"
                className="px-5 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium active:scale-[0.98] transition-transform inline-flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
                Dashboard
              </a>
              <a
                href="/scan"
                className="px-5 py-2.5 bg-[var(--color-primary)] text-white rounded-xl text-sm font-medium active:scale-[0.98] transition-transform inline-flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM6.75 6.75h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
                </svg>
                Scan Shop QR
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {logs.map((log, idx) => {
              const config = getStatusConfig(log.status);
              const isFirstToday =
                idx === 0 ||
                new Date(log.created_at).toDateString() !==
                  new Date(logs[idx - 1]?.created_at).toDateString();

              return (
                <div key={log.id}>
                  {/* Date separator */}
                  {isFirstToday && (
                    <div className="flex items-center gap-2 py-3">
                      <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                        {new Date(log.created_at).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "long",
                          day: "numeric",
                          timeZone: "Asia/Kathmandu",
                        })}
                      </span>
                      <div className="flex-1 h-px bg-gray-100" />
                    </div>
                  )}

                  {/* Transaction card */}
                  <div className={`bg-white rounded-xl p-4 shadow-sm border border-gray-50 active:scale-[0.99] transition-transform ${log.status === "rejected" ? "opacity-60" : ""}`}>
                    <div className="flex items-start gap-3">
                      {/* Type icon */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${log.type === "debit" ? "bg-red-50" : "bg-green-50"}`}>
                        <TransactionIcon type={log.type} size={18} className={log.type === "debit" ? "text-red-600" : "text-green-600"} />
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm text-[var(--color-text)] truncate">
                            {log.merchants?.name || "Shop"}
                          </p>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${config.bg} border`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                            {log.status}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">
                          {log.description || "No description"}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <svg className="w-3 h-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-[10px] text-[var(--color-text-muted)]">
                            {new Date(log.created_at).toLocaleDateString("en-US", {
                              month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kathmandu",
                            })}
                            {log.approved_at && ` · Approved ${new Date(log.approved_at).toLocaleDateString("en-US", {
                              month: "short", day: "numeric", timeZone: "Asia/Kathmandu",
                            })}`}
                          </p>
                        </div>
                      </div>

                      {/* Amount */}
                      <div className="text-right flex-shrink-0">
                        <p className={`font-bold text-sm ${
                          log.status === "rejected"
                            ? "text-slate-400 line-through"
                            : log.type === "debit"
                              ? "text-red-600"
                              : "text-green-600"
                        }`}>
                          Rs. {log.amount.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-[var(--color-text-muted)] capitalize">
                          {log.type === "debit" ? "Debit" : "Credit"}
                        </p>
                      </div>
                    </div>

                    {log.status === "pending" && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
                        <button
                          onClick={() =>
                            setEditModal({
                              id: log.id,
                              amount: log.amount,
                              description: log.description || "",
                            })
                          }
                          className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium active:scale-[0.98]"
                        >
                          Edit
                        </button>
                        <button
                          onClick={async () => {
                            await cancelCreditLog(log.id);
                            addToast("Entry cancelled.", "info");
                            loadLogs();
                          }}
                          className="flex-1 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-medium active:scale-[0.98]"
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    {log.status === "unverified" && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50">
                        <button
                          onClick={async () => {
                            await disputeEntry(log.id);
                            addToast("Entry disputed. Merchant notified.", "warning");
                            loadLogs();
                          }}
                          className="flex-1 py-2 bg-orange-50 text-orange-600 rounded-lg text-xs font-medium active:scale-[0.98]"
                        >
                          Dispute
                        </button>
                        <button
                          onClick={async () => {
                            await confirmCustomerEntry(log.id);
                            addToast("Entry confirmed! Balance updated.", "success");
                            loadLogs();
                          }}
                          className="flex-1 py-2 bg-green-600 text-white rounded-lg text-xs font-medium active:scale-[0.98]"
                        >
                          Confirm Balance
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </PullToRefresh>

      <CustomerBottomNav />

      {/* Edit Modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center" onClick={() => setEditModal(null)}>
          <div
            className="bg-white rounded-t-2xl w-full max-w-md p-6 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-[var(--color-text)] mb-4">Edit Entry</h2>
            <label className="text-sm font-medium text-[var(--color-text)]">Amount (Rs.)</label>
            <input
              type="number"
              min="1"
              step="1"
              value={editModal.amount}
              onChange={(e) => setEditModal({ ...editModal, amount: Number(e.target.value) })}
              className="w-full mt-1 mb-3 px-4 py-3 bg-white rounded-xl text-lg font-bold border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
            />
            <label className="text-sm font-medium text-[var(--color-text)]">Description</label>
            <input
              type="text"
              value={editModal.description}
              onChange={(e) => setEditModal({ ...editModal, description: e.target.value })}
              placeholder="e.g. Rice 10kg, Milk 2L"
              className="w-full mt-1 mb-4 px-4 py-3 bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setEditModal(null)}
                className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium active:scale-[0.98] transition-transform"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await updateCreditLog(editModal.id, {
                    amount: editModal.amount,
                    description: editModal.description,
                  });
                  setEditModal(null);
                  addToast("Entry updated.", "success");
                  loadLogs();
                }}
                className="flex-1 py-3 bg-[var(--color-primary)] text-white rounded-xl font-medium active:scale-[0.98] transition-transform"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
