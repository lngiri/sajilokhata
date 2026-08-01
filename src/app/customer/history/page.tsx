"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CustomerBottomNav from "@/components/CustomerBottomNav";
import PullToRefresh from "@/components/PullToRefresh";
import { useToast } from "@/components/Toast";
import { getCustomerCreditLogs, getCustomerLogCounts, updateCreditLog, cancelCreditLog, confirmCustomerEntry, disputeEntry, getCustomerIdsForPhone } from "@/app/actions/customer";
import TransactionIcon from "@/components/TransactionIcon";
import { playSuccessSound } from "@/lib/sound";
import CustomerPinGate from "@/components/CustomerPinGate";
import PageHeader from "@/components/PageHeader";
import { formatNumber } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

/** Key used to persist customer session in localStorage */
const CUSTOMER_STORAGE_KEY = "sajilo_customer_session";
const LAST_SEEN_KEY = "customer_history_last_seen";
const PAGE_SIZE = 50;
const SELF_ACTION_WINDOW_MS = 4000;

interface HistoryEntry {
  id: string;
  amount: number;
  type: "debit" | "credit";
  status: string;
  description: string | null;
  created_at: string;
  approved_at: string | null;
  initiated_by: "merchant" | "customer" | null;
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
  awaiting_confirmation: { bg: "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800", dot: "bg-amber-500" },
  approved: { bg: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800", dot: "bg-green-500" },
  rejected: { bg: "bg-slate-50 dark:bg-slate-900/20 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700", dot: "bg-slate-400 dark:bg-slate-500" },
  disputed: { bg: "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800", dot: "bg-purple-500" },
} as const;

function getStatusConfig(status: string) {
  return statusConfig[status as keyof typeof statusConfig] || {
    bg: "bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600",
    dot: "bg-gray-400 dark:bg-gray-500",
  };
}

const STATUS_LABEL: Record<string, string> = {
  awaiting_confirmation: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  disputed: "Disputed",
};

const FILTER_TABS = [
  { key: "all", label: "All" },
  { key: "awaiting_confirmation", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "disputed", label: "Disputed" },
] as const;

type FilterKey = (typeof FILTER_TABS)[number]["key"];

const FILTER_LABEL: Record<FilterKey, string> = {
  all: "transactions",
  awaiting_confirmation: "pending confirmations",
  approved: "approved entries",
  rejected: "rejected entries",
  disputed: "disputed entries",
};

function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kathmandu" });
}

export default function CustomerHistoryPage() {
  const { addToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const merchantIdParam = searchParams?.get("merchantId") || "";
  const shopNameParam = searchParams?.get("shopName") || "";
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [logs, setLogs] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [stats, setStats] = useState({ total: 0, awaiting_confirmation: 0, approved: 0, rejected: 0, disputed: 0 });
  const [editModal, setEditModal] = useState<{ id: string; amount: number; description: string } | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [txOffset, setTxOffset] = useState(0);
  const [loadMoreLoading, setLoadMoreLoading] = useState(false);
  // Snapshot of the last-visit timestamp — never mutated during this visit,
  // so "N" badges render for entries created since the previous visit.
  const [lastSeenAt] = useState(() => {
    try { return Number(localStorage.getItem(LAST_SEEN_KEY)) || Date.now(); } catch { return Date.now(); }
  });
  const mountedRef = useRef(true);
  const realtimeChannelRef = useRef<any>(null);
  const realtimeSetupRef = useRef(false);
  const realtimeSupabaseRef = useRef<any>(null);
  const loadLogsRef = useRef<(opts?: { silent?: boolean }) => Promise<void>>(async () => {});
  const selfChangedRef = useRef<{ id: string; at: number } | null>(null);

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

  // Mark-as-seen: persist "now" for the NEXT visit only (badges for this visit
  // still compare against the snapshot captured at init above).
  useEffect(() => {
    try { localStorage.setItem(LAST_SEEN_KEY, String(Date.now())); } catch {}
  }, []);

  // Load logs
  const loadLogs = useCallback(async (opts?: { silent?: boolean }) => {
    if (!customerPhone) return;
    if (!opts?.silent) {
      setLogs([]);
      setLoading(true);
    }
    try {
      const [data, counts] = await Promise.all([
        getCustomerCreditLogs(customerPhone, {
          status: filter === "all" ? undefined : filter,
          merchant_id: merchantIdParam || undefined,
          limit: PAGE_SIZE,
        }),
        getCustomerLogCounts(merchantIdParam || undefined),
      ]);
      if (!mountedRef.current) return;
      setLogs(data as HistoryEntry[]);
      setHasMore(data.length === PAGE_SIZE);
      setTxOffset(data.length);
      setStats(counts);
    } catch {
      if (mountedRef.current) addToast("Failed to load transaction history.", "error");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [customerPhone, filter, merchantIdParam, addToast]);

  const loadMore = useCallback(async () => {
    if (!customerPhone || loadMoreLoading) return;
    setLoadMoreLoading(true);
    try {
      const more = await getCustomerCreditLogs(customerPhone, {
        status: filter === "all" ? undefined : filter,
        merchant_id: merchantIdParam || undefined,
        limit: PAGE_SIZE,
        offset: txOffset,
      });
      if (!mountedRef.current) return;
      setLogs((prev) => [...prev, ...(more as HistoryEntry[])]);
      setTxOffset((o) => o + more.length);
      setHasMore(more.length === PAGE_SIZE);
    } catch {
      if (mountedRef.current) addToast("Failed to load more transactions.", "error");
    } finally {
      if (mountedRef.current) setLoadMoreLoading(false);
    }
  }, [customerPhone, filter, merchantIdParam, txOffset, loadMoreLoading, addToast]);

  const runAction = useCallback(async (id: string, fn: () => Promise<unknown>, success: string) => {
    setBusyId(id);
    selfChangedRef.current = { id, at: Date.now() };
    try {
      await fn();
      addToast(success, "success");
      await loadLogs({ silent: true });
    } catch {
      addToast("Something went wrong. Please try again.", "error");
    } finally {
      setBusyId(null);
      selfChangedRef.current = null;
    }
  }, [addToast, loadLogs]);

  // Load logs on mount / filter / merchant change
  useEffect(() => {
    if (customerPhone) loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerPhone, filter, merchantIdParam]);

  // Supabase Realtime — listen for INSERT + UPDATE on credit_logs
  useEffect(() => {
    if (!customerPhone || realtimeSetupRef.current) return;
    realtimeSetupRef.current = true;

    const setupRealtime = async () => {
      const customerIds = await getCustomerIdsForPhone(customerPhone);
      if (!realtimeSetupRef.current) return;
      if (customerIds.length === 0) return;

      const supabase = createClient();
      realtimeSupabaseRef.current = supabase;

      realtimeChannelRef.current = supabase
        .channel("customer-history-realtime")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "credit_logs",
            filter: `customer_id=in.(${customerIds.join(",")})`,
          },
          (payload: any) => {
            if (!mountedRef.current) return;
            const oldStatus = payload.old?.status;
            const newStatus = payload.new?.status;
            if (oldStatus && newStatus && oldStatus !== newStatus) {
              // Skip toast/reload for changes this client just made itself.
              const self = selfChangedRef.current;
              if (self && self.id === payload.new?.id && Date.now() - self.at < SELF_ACTION_WINDOW_MS) {
                return;
              }
              if (newStatus === "approved") {
                playSuccessSound();
              }
              const verb =
                newStatus === "approved"
                  ? "Approved!"
                  : newStatus === "rejected"
                    ? "Rejected"
                    : newStatus;
              addToast(
                `${verb} Rs. ${formatNumber(payload.new?.amount)} request`,
                newStatus === "approved" ? "success" : "warning"
              );
              loadLogsRef.current?.({ silent: true });
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "credit_logs",
            filter: `customer_id=in.(${customerIds.join(",")})`,
          },
          (payload: any) => {
            if (!mountedRef.current) return;
            addToast(
              `New ${payload.new?.type || "transaction"} of Rs. ${formatNumber(payload.new?.amount)} added`,
              "info"
            );
            loadLogsRef.current?.({ silent: true });
          }
        )
        .subscribe();
    };

    setupRealtime();

    return () => {
      realtimeSetupRef.current = false;
      if (realtimeChannelRef.current && realtimeSupabaseRef.current) {
        realtimeSupabaseRef.current.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [customerPhone, addToast]);

  // Keep loadLogsRef current for the realtime channel callback
  useEffect(() => {
    loadLogsRef.current = loadLogs;
  }, [loadLogs]);

  // Mounted ref + cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Escape closes the edit modal
  useEffect(() => {
    if (!editModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditModal(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editModal]);

  // Handle clear session — removes localStorage, cookies, SW caches
  const handleSignOut = () => {
    localStorage.removeItem(CUSTOMER_STORAGE_KEY);
    localStorage.removeItem("qr_hisab_auth_" + customerPhone);
    window.location.replace("/");
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
    <CustomerPinGate phone={customerPhone || ""} onUnlocked={() => {}} onSignOut={handleSignOut}>
    <div className="min-h-dvh bg-[var(--color-bg)] pb-20">
      <PageHeader
        title={shopNameParam ? `${shopNameParam}'s Khata 📒` : "Your Khata 📒"}
        backHref="/customer/dashboard"
        backLabel="Back to dashboard"
        rightSlot={
          <button
            onClick={handleSignOut}
            className="text-xs text-[var(--color-text-muted)] px-2.5 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 active:scale-95 transition-all"
          >
            Sign Out
          </button>
        }
      />

        {/* Filter tabs */}
        <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto">
          {FILTER_TABS.map((tab) => {
            const count = tab.key === "all" ? stats.total : stats[tab.key];
            return (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium capitalize whitespace-nowrap transition-all ${
                  filter === tab.key
                    ? "bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] shadow-sm"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    filter === tab.key ? "bg-white/20" : "bg-gray-200 dark:bg-gray-700 text-[var(--color-text-muted)]"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Shop filter chip */}
        {merchantIdParam && (
          <button
            onClick={() => router.replace("/customer/history")}
            className="mx-4 mb-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-95 transition-all"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            {shopNameParam || "Shop"} &middot; View all shops
          </button>
        )}

      {/* Pending / Unverified banner — jumps straight to the pending list */}
      {!loading && stats.awaiting_confirmation > 0 && (
        <button
          onClick={() => setFilter("awaiting_confirmation")}
          className="w-full flex items-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800 active:bg-amber-100 dark:active:bg-amber-900/30 transition-colors text-left"
        >
          <div className="w-6 h-6 rounded-full bg-amber-200 dark:bg-amber-700 flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-sm font-medium text-amber-800 dark:text-amber-300 flex-1">
            {stats.awaiting_confirmation} pending — review needed
          </span>
          <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      )}

      {/* Content */}
      <PullToRefresh onRefresh={() => loadLogs({ silent: true })}>
        <div className="px-4 py-4">
          {loading && logs.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center">
              <svg className="w-10 h-10 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="font-medium text-[var(--color-text-muted)]">
              {filter === "all" ? "No transactions yet 📝" : `No ${FILTER_LABEL[filter]} 📝`}
            </p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              {filter === "all"
                ? "Scan a shop QR or search by phone to get started ✨"
                : `You have no ${FILTER_LABEL[filter]} yet.`}
            </p>
            <div className="flex gap-3 justify-center mt-4">
              <a
                href="/customer/dashboard"
                className="px-5 py-2.5 bg-gray-100 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-medium active:scale-[0.98] transition-transform inline-flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
                Dashboard
              </a>
              <a
                href="/scan"
                className="px-5 py-2.5 bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] rounded-xl text-sm font-medium active:scale-[0.98] transition-transform inline-flex items-center gap-2"
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
              const prev = logs[idx - 1];
              const isFirstToday =
                idx === 0 || !prev || dayKey(log.created_at) !== dayKey(prev.created_at);

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
                      <div className="flex-1 h-px bg-gray-100 dark:bg-gray-700" />
                    </div>
                  )}

                  {/* Transaction card */}
                  <div className={`bg-[var(--color-surface)] rounded-xl p-4 shadow-sm border border-gray-50 dark:border-gray-700 active:scale-[0.99] transition-transform ${log.status === "rejected" ? "opacity-60" : ""}`}>
                    <div className="flex items-start gap-3">
                      {/* Type icon */}
                      <div className={`relative w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${log.type === "debit" ? "bg-red-50 dark:bg-red-900/20" : "bg-green-50 dark:bg-green-900/20"}`}>
                        <TransactionIcon type={log.type} size={18} className={log.type === "debit" ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"} />
                        {new Date(log.created_at).getTime() > lastSeenAt && (
                          <span className="absolute top-0 right-0 w-4 h-4 rounded-full bg-[var(--color-primary-surface)] border border-[var(--color-primary-foreground)] text-[7px] font-bold text-[var(--color-primary-foreground)] flex items-center justify-center">N</span>
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
                            {STATUS_LABEL[log.status] || log.status}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">
                          {log.description || "No description"}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <svg className="w-3 h-3 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                              ? "text-red-600 dark:text-red-400"
                              : "text-green-600 dark:text-green-400"
                        }`}>
                          Rs. {formatNumber(log.amount)}
                        </p>
                        <p className="text-[10px] text-[var(--color-text-muted)] capitalize">
                          {log.type === "debit" ? "Debit" : "Credit"}
                        </p>
                      </div>
                    </div>

                    {log.status === "awaiting_confirmation" && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50 dark:border-gray-700">
                        <button
                          disabled={busyId === log.id}
                          onClick={() =>
                            setEditModal({
                              id: log.id,
                              amount: log.amount,
                              description: log.description || "",
                            })
                          }
                          className="flex-1 py-2 bg-gray-100 text-gray-600 dark:text-gray-300 rounded-lg text-xs font-medium active:scale-[0.98] disabled:opacity-50"
                        >
                          Edit
                        </button>
                        <button
                          disabled={busyId === log.id}
                          onClick={async () => {
                            if (!window.confirm("Cancel this entry? It will be rejected and removed from your balance.")) return;
                            await runAction(log.id, () => cancelCreditLog(log.id), "Entry cancelled.");
                          }}
                          className="flex-1 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-xs font-medium active:scale-[0.98] disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    {log.status === "awaiting_confirmation" &&
                      (log.initiated_by === "customer" ? (
                        <div className="mt-3 pt-3 border-t border-gray-50 dark:border-gray-700">
                          <div className="flex-1 py-2 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-300 rounded-lg text-xs font-medium text-center">
                            Waiting for shopkeeper approval
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50 dark:border-gray-700">
                          <button
                            disabled={busyId === log.id}
                            onClick={async () => {
                              if (!window.confirm("Dispute this entry? The merchant will be notified to resolve it.")) return;
                              await runAction(log.id, () => disputeEntry(log.id), "Entry disputed. Merchant notified.");
                            }}
                            className="flex-1 py-2 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-lg text-xs font-medium active:scale-[0.98] disabled:opacity-50"
                          >
                            Dispute
                          </button>
                          <button
                            disabled={busyId === log.id}
                            onClick={async () => {
                              await runAction(log.id, () => confirmCustomerEntry(log.id), "Entry confirmed! Balance updated.");
                            }}
                            className="flex-1 py-2 bg-green-600 text-white rounded-lg text-xs font-medium active:scale-[0.98] disabled:opacity-50"
                          >
                            Confirm Balance
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              );
            })}

            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loadMoreLoading}
                className="w-full py-3 mt-3 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-medium text-[var(--color-text-muted)] active:scale-[0.98] transition-transform disabled:opacity-60"
              >
                {loadMoreLoading ? "Loading…" : "Load More"}
              </button>
            )}
          </div>
        )}
      </div>
      </PullToRefresh>

      <CustomerBottomNav />

      {/* Edit Modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center" onClick={() => setEditModal(null)}>
          <div
            className="bg-[var(--color-surface)] rounded-t-2xl w-full max-w-md p-6 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-[var(--color-text)] mb-4">Edit Entry</h2>
            <label className="text-sm font-medium text-[var(--color-text)]">Amount</label>
            <input
              type="number"
              min="1"
              step="any"
              value={editModal.amount}
              onChange={(e) => setEditModal({ ...editModal, amount: Number(e.target.value) })}
              className="w-full mt-1 mb-3 px-4 py-3 bg-[var(--color-surface)] rounded-xl text-lg font-bold border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
            />
            <label className="text-sm font-medium text-[var(--color-text)]">Description</label>
            <input
              type="text"
              value={editModal.description}
              onChange={(e) => setEditModal({ ...editModal, description: e.target.value })}
              placeholder="e.g. Rice 10kg, Milk 2L"
              className="w-full mt-1 mb-4 px-4 py-3 bg-[var(--color-surface)] rounded-xl border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setEditModal(null)}
                disabled={editSaving}
                className="flex-1 py-3 bg-gray-100 text-gray-600 dark:text-gray-300 rounded-xl font-medium active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={editSaving}
                onClick={async () => {
                  if (editSaving) return;
                  setEditSaving(true);
                  selfChangedRef.current = { id: editModal.id, at: Date.now() };
                  try {
                    await updateCreditLog(editModal.id, {
                      amount: editModal.amount,
                      description: editModal.description,
                    });
                    setEditModal(null);
                    addToast("Entry updated.", "success");
                    await loadLogs({ silent: true });
                  } catch {
                    addToast("Failed to update entry.", "error");
                  } finally {
                    setEditSaving(false);
                    selfChangedRef.current = null;
                  }
                }}
                className="flex-1 py-3 bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] rounded-xl font-medium active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                {editSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </CustomerPinGate>
  );
}
