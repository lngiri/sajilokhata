"use client";

import { useState, useEffect } from "react";
import CustomerBottomNav from "@/components/CustomerBottomNav";
import { useToast } from "@/components/Toast";
import { getCustomerCreditLogs } from "@/lib/actions";

/** Key used to persist customer session in localStorage */
const CUSTOMER_STORAGE_KEY = "sajilo_customer_session";

interface HistoryEntry {
  id: string;
  amount: number;
  type: string;
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
  approved: { bg: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-500" },
  rejected: { bg: "bg-red-50 text-red-600 border-red-200", dot: "bg-red-500" },
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
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [logs, setLogs] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });

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
  }, [customerPhone, filter]);

  const loadLogs = async () => {
    if (!customerPhone) return;
    setLoading(true);
    try {
      const data = await getCustomerCreditLogs(customerPhone, {
        status: filter === "all" ? undefined : filter,
        limit: 100,
      });
      setLogs(data as HistoryEntry[]);

      // Calculate status counts
      const counts = { total: data.length, pending: 0, approved: 0, rejected: 0 };
      data.forEach((l: HistoryEntry) => {
        if (l.status === "pending") counts.pending++;
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

  // Handle clear session — removes both localStorage and cookie
  const handleSignOut = () => {
    try {
      localStorage.removeItem(CUSTOMER_STORAGE_KEY);
      // Expire the cookie so middleware stops protecting /customer/*
      document.cookie = "customer_session=; path=/; max-age=0";
    } catch {
      // Ignore
    }
    window.location.href = "/";
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
            <h1 className="text-lg font-bold text-[var(--color-text)]">Transaction History</h1>
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

      {/* Content */}
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
            <a
              href="/customer/dashboard"
              className="inline-block mt-4 px-5 py-2.5 bg-[var(--color-primary)] text-white rounded-xl text-sm font-medium active:scale-[0.98] transition-transform"
            >
              Back to Dashboard
            </a>
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
                        })}
                      </span>
                      <div className="flex-1 h-px bg-gray-100" />
                    </div>
                  )}

                  {/* Transaction card */}
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-50 active:scale-[0.99] transition-transform">
                    <div className="flex items-start gap-3">
                      {/* Status indicator */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${config.bg}`}>
                        {log.status === "approved" ? (
                          <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        ) : log.status === "pending" ? (
                          <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
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
                              month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                            })}
                            {log.approved_at && ` · Approved ${new Date(log.approved_at).toLocaleDateString("en-US", {
                              month: "short", day: "numeric",
                            })}`}
                          </p>
                        </div>
                      </div>

                      {/* Amount */}
                      <div className="text-right flex-shrink-0">
                        <p className={`font-bold text-sm ${
                          log.status === "approved"
                            ? "text-[var(--color-danger)]"
                            : log.status === "rejected"
                              ? "text-gray-400"
                              : "text-[var(--color-text)]"
                        }`}>
                          NPR {log.amount.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-[var(--color-text-muted)] capitalize">
                          {log.type === "debit" ? "Debit" : "Credit"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CustomerBottomNav />
    </div>
  );
}
