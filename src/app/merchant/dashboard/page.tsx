"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import BottomNav from "@/components/BottomNav";
import SyncStatus from "@/components/SyncStatus";
import PullToRefresh from "@/components/PullToRefresh";
import { QRDisplay } from "@/components/QRCode";
import { useToast } from "@/components/Toast";
import { playSuccessSound } from "@/lib/sound";
import { createClient } from "@/lib/supabase/client";
import {
  getMerchantStats,
  getMerchantCreditLogs,
  getMerchantProfile,
  acceptEditRequest,
  rejectEditRequest,
} from "@/lib/actions";
import { getCurrentMerchantId } from "@/lib/auth";
import { useRouter } from "next/navigation";
import TransactionIcon from "@/components/TransactionIcon";

/** Polling interval for auto-refreshing pending approvals (in ms) */
const POLL_INTERVAL = 30_000;

/** Format a timestamp as a relative time string (e.g. "2 min ago") */
function timeAgo(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const seconds = Math.floor((now - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface MerchantProfile {
  id: string;
  name: string;
  business_type: string;
  business_name: string | null;
  phone?: string;
}

export default function MerchantDashboard() {
  const { addToast } = useToast();
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [merchantProfile, setMerchantProfile] = useState<MerchantProfile | null>(null);
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
      type: "debit" | "credit";
      status: string;
      description: string | null;
      proposed_amount: number | null;
      created_at: string;
      customer_id: string | null;
      customers: { name: string | null; phone: string } | null;
    }[]
  >([]);
  const [recentActivity, setRecentActivity] = useState<
    {
      id: string;
      amount: number;
      type: "debit" | "credit";
      status: string;
      description: string | null;
      created_at: string;
      customers: { name: string | null; phone: string } | null;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const router = useRouter();
  const mountedRef = useRef(true);
  const merchantIdRef = useRef<string | null>(null);

  // QR Modal state (Issue 3: pull-to-refresh)
  const [showQRModal, setShowQRModal] = useState(false);

  useEffect(() => {
    if (!showQRModal) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowQRModal(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showQRModal]);

  // Show welcome toast based on account status from login redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    if (status === "new") {
      addToast("बधाई छ! सजिलो खातामा तपाईंको नयाँ पसल दर्ता भयो।", "success");
    } else if (status === "existing") {
      addToast("स्वागत छ! तपाईंको पुरानो खाता लोड भयो।", "success");
    }
    if (status) {
      window.history.replaceState({}, "", "/merchant/dashboard");
    }
  }, [addToast]);

  const supabase = useRef(createClient()).current;

  const loadData = useCallback(async () => {
    const id = merchantIdRef.current || (await getCurrentMerchantId());
    if (!mountedRef.current) return;

    setMerchantId(id);
    merchantIdRef.current = id;

    if (id) {
      try {
        const [statsData, pendingData, editRequestedData, activityData, profileData] = await Promise.all([
          getMerchantStats(id),
          getMerchantCreditLogs(id, { status: "pending", limit: 10 }),
          getMerchantCreditLogs(id, { status: "edit_requested", limit: 10 }),
          getMerchantCreditLogs(id, { limit: 15 }),
          getMerchantProfile(id).catch(() => null),
        ]);
        if (!mountedRef.current) return;
        setStats(statsData);
        setPendingLogs([...pendingData, ...editRequestedData] as typeof pendingLogs);
        setRecentActivity(activityData as typeof recentActivity);
        setMerchantProfile(profileData);
        setLastRefreshed(new Date());
        setLoadError(false);
      } catch {
        setLoadError(true);
        addToast("Failed to load dashboard data.", "error");
      }
    }
  }, []);

  // Initial load + polling
  useEffect(() => {
    mountedRef.current = true;

    loadData().finally(() => {
      if (mountedRef.current) setLoading(false);
    });

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadData();
      }
    }, POLL_INTERVAL);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadData();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [loadData]);

  // ================================================================
  // Issue 1: Supabase Realtime — new credit log INSERT for this merchant
  // ================================================================
  useEffect(() => {
    if (!merchantId) return;

    const channel = supabase
      .channel("merchant-dashboard-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "credit_logs",
          filter: `merchant_id=eq.${merchantId}`,
        },
        (payload: any) => {
          if (!mountedRef.current) return;
          const customerName = payload.new?.description || "a customer";
          addToast(
            `📥 New credit request: NPR ${Number(payload.new?.amount || 0).toLocaleString()} — ${customerName}`,
            "info"
          );
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [merchantId, addToast, loadData, supabase]);

  // ================================================================
  // Issue 1: Realtime — credit_log UPDATE (status changes)
  // ================================================================
  useEffect(() => {
    if (!merchantId) return;

    const channel = supabase
      .channel("merchant-dashboard-updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "credit_logs",
          filter: `merchant_id=eq.${merchantId}`,
        },
        (payload: any) => {
          if (!mountedRef.current) return;
          const oldStatus = payload.old?.status;
          const newStatus = payload.new?.status;
          if (oldStatus !== newStatus && newStatus) {
            if (newStatus === "approved") {
              playSuccessSound();
            }
            addToast(
              `📝 Entry ${newStatus}: NPR ${Number(payload.new?.amount || 0).toLocaleString()}`,
              newStatus === "approved" ? "success" : "warning"
            );
            loadData();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [merchantId, addToast, loadData, supabase]);

  // ================================================================
  // Issue 3: Handle pull-to-refresh — show QR modal + silent refetch
  // ================================================================
  const handlePullRefresh = async () => {
    setShowQRModal(true);
    try {
      await loadData();
    } catch {
      // Silent — data already refreshed
    }
  };

  const handleCloseQR = () => {
    setShowQRModal(false);
  };

  const handleBrandingRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadData();
      router.refresh();
    } finally {
      setTimeout(() => setIsRefreshing(false), 2000);
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

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={handleBrandingRefresh}
            className="text-left active:scale-95 transition-transform flex items-center gap-2"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] flex items-center justify-center shadow-sm flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-[var(--color-primary)]">
                Sajilo Khata
              </h1>
              <p className="text-xs text-[var(--color-text-muted)]">
                Digital Diary
              </p>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </p>
            </div>
          </button>
          <div className="flex items-center gap-2">
            {merchantProfile && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200">
                <svg className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
                </svg>
                <span className="text-[11px] font-medium text-slate-700 whitespace-nowrap">पसल: {merchantProfile.name}</span>
              </div>
            )}
            {isRefreshing ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-blue-200 bg-blue-50">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-[10px] font-medium text-blue-600">Syncing...</span>
              </div>
            ) : (
              <SyncStatus />
            )}
          </div>
        </div>
      </div>

      {/* Pending banner */}
      {!loading && pendingLogs.length > 0 && (
        <a
          href="/merchant/logs"
          className="flex items-center gap-2 px-4 py-3 bg-amber-50 border-b border-amber-100 active:bg-amber-100 transition-colors"
        >
          <div className="w-6 h-6 rounded-full bg-amber-200 flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-sm font-medium text-amber-800 flex-1 text-left">
            {pendingLogs.length} {pendingLogs.length === 1 ? "entry" : "entries"} pending approval
          </span>
          <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </a>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-50 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <p className="font-medium text-[var(--color-text)]">Could not load data</p>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Check your connection and try again</p>
          <button
            onClick={loadData}
            className="mt-4 px-6 py-2.5 bg-[var(--color-primary)] text-white rounded-xl text-sm font-medium active:scale-[0.98] transition-transform flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
            Retry
          </button>
        </div>
      ) : (
        <PullToRefresh onRefresh={handlePullRefresh}>
          <div className="px-4 py-4 space-y-4">
            {/* Stats Cards */}
            {stats && (
              <div className="grid grid-cols-2 gap-3">
                <a href="/merchant/logs" className="block bg-white rounded-2xl p-4 shadow-sm border border-gray-50 active:scale-[0.98] transition-transform">
                  <p className="text-xs text-[var(--color-text-muted)] mb-1">Outstanding</p>
                  <p className="text-xl font-bold text-[var(--color-danger)]">NPR {stats.totalOutstanding.toLocaleString()}</p>
                </a>
                <a href="/merchant/logs" className="block bg-white rounded-2xl p-4 shadow-sm border border-gray-50 active:scale-[0.98] transition-transform">
                  <p className="text-xs text-[var(--color-text-muted)] mb-1">Today</p>
                  <p className="text-xl font-bold text-[var(--color-primary)]">NPR {stats.todayTotal.toLocaleString()}</p>
                </a>
                <a href="/merchant/customers" className="block bg-white rounded-2xl p-4 shadow-sm border border-gray-50 active:scale-[0.98] transition-transform">
                  <p className="text-xs text-[var(--color-text-muted)] mb-1">Customers</p>
                  <p className="text-xl font-bold text-[var(--color-text)]">{stats.customerCount}</p>
                </a>
                <a href="/merchant/logs" className="block bg-white rounded-2xl p-4 shadow-sm border border-gray-50 relative overflow-hidden active:scale-[0.98] transition-transform">
                  <p className="text-xs text-[var(--color-text-muted)] mb-1">Pending</p>
                  <p className="text-xl font-bold text-[var(--color-accent)]">{stats.pendingCount}</p>
                  {stats.pendingCount > 0 && (
                    <div className="absolute top-2 right-2 w-2 h-2 bg-[var(--color-accent)] rounded-full animate-pulse-soft" />
                  )}
                </a>
              </div>
            )}

            {/* Quick Actions */}
            <div className="flex gap-3">
              <a
                href="/merchant/scan?manual=true"
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-[var(--color-primary)] text-white rounded-xl font-medium text-sm active:scale-[0.98] transition-transform"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Manual Entry
              </a>
              <button
                onClick={() => setShowQRModal(true)}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-white text-[var(--color-text)] border border-gray-200 rounded-xl font-medium text-sm active:scale-[0.98] transition-transform cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                </svg>
                Show QR
              </button>
              <a
                href="/merchant/reports"
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-white text-[var(--color-text)] border border-gray-200 rounded-xl font-medium text-sm active:scale-[0.98] transition-transform"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Reports
              </a>
            </div>

            {/* Issue 4: Recent Customer Activity Feed */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-[var(--color-text)]">
                  Recent Activity
                </h2>
                {lastRefreshed && (
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    {timeAgo(lastRefreshed.toISOString())}
                  </span>
                )}
              </div>

              {recentActivity.length === 0 ? (
                <div className="text-center py-8 text-[var(--color-text-muted)]">
                  <svg className="w-12 h-12 mx-auto mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm">No activity yet</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {recentActivity.slice(0, 10).map((log) => {
                    const customerId = (log as any).customer_id;
                    const href = customerId ? `/merchant/customers/${customerId}` : "#";
                    return (
                      <a
                        key={log.id}
                        href={href}
                        className={`block bg-white rounded-xl p-3.5 shadow-sm border border-gray-50 flex items-center gap-3 active:scale-[0.98] transition-transform ${log.status === "rejected" ? "opacity-60" : ""}`}
                      >
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${log.type === "debit" ? "bg-red-50" : "bg-green-50"}`}>
                          <TransactionIcon type={log.type} size={14} className={log.type === "debit" ? "text-red-600" : "text-green-600"} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm text-[var(--color-text)] truncate">
                              {log.customers?.name || log.customers?.phone || "Unknown"}
                            </p>
                            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium capitalize ${statusColor(log.status)}`}>
                              {log.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                            {log.description || timeAgo(log.created_at)}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`font-bold text-xs ${log.status === "rejected" ? "text-slate-400 line-through" : log.type === "debit" ? "text-red-600" : "text-green-600"}`}>
                            NPR {log.amount.toLocaleString()}
                          </p>
                          <p className="text-[9px] text-[var(--color-text-muted)]">
                            {timeAgo(log.created_at)}
                          </p>
                        </div>
                      </a>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pending Approvals */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-[var(--color-text)]">
                    Pending Approvals
                  </h2>
                  {lastRefreshed && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[var(--color-primary)]/5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-pulse" />
                      <span className="text-[10px] text-[var(--color-primary)] font-medium">
                        Live
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {lastRefreshed && (
                    <span className="text-[10px] text-[var(--color-text-muted)]">
                      {timeAgo(lastRefreshed.toISOString())}
                    </span>
                  )}
                  {pendingLogs.length > 0 && (
                    <span className="px-2 py-0.5 bg-[var(--color-accent)]/10 text-[var(--color-accent)] text-xs font-medium rounded-full">
                      {pendingLogs.length}
                    </span>
                  )}
                </div>
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
                  {pendingLogs.map((log) => {
                    const isEditRequest = log.status === "edit_requested";
                    const customerId = log.customer_id;
                    const href = customerId ? `/merchant/customers/${customerId}` : "#";
                    return (
                      <div
                        key={log.id}
                        className={`bg-white rounded-xl p-4 shadow-sm border flex items-center gap-3 ${
                          isEditRequest ? "border-blue-200 bg-blue-50/30" : "border-gray-50"
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${log.type === "debit" ? "bg-red-50" : "bg-green-50"}`}>
                          <TransactionIcon type={log.type} size={16} className={log.type === "debit" ? "text-red-600" : "text-green-600"} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-[var(--color-text)] truncate">
                            {log.customers?.name || log.customers?.phone || "Unknown"}
                          </p>
                          <p className="text-xs text-[var(--color-text-muted)] truncate">
                            {log.description || "No description"}
                          </p>
                          {isEditRequest && log.proposed_amount && (
                            <p className="text-xs text-blue-700 font-medium mt-1">
                              ग्राहकले रकम NPR {log.amount.toLocaleString()} बाट NPR {log.proposed_amount.toLocaleString()} मा परिवर्तन गर्न अनुरोध गरेको छ
                            </p>
                          )}
                        </div>
                        <div className="flex-shrink-0 space-y-1">
                          {isEditRequest ? (
                            <>
                              <button
                                onClick={async () => {
                                  try {
                                    await acceptEditRequest(log.id);
                                    addToast("Edit accepted", "success");
                                    loadData();
                                  } catch {
                                    addToast("Failed to accept edit", "error");
                                  }
                                }}
                                className="w-full px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium active:scale-[0.97] transition-transform"
                              >
                                स्वीकार गर्नुहोस्
                              </button>
                              <button
                                onClick={async () => {
                                  try {
                                    await rejectEditRequest(log.id);
                                    addToast("Edit rejected", "success");
                                    loadData();
                                  } catch {
                                    addToast("Failed to reject edit", "error");
                                  }
                                }}
                                className="w-full px-3 py-1.5 bg-gray-200 text-gray-600 rounded-lg text-xs font-medium active:scale-[0.97] transition-transform"
                              >
                                अस्वीकार गर्नुहोस्
                              </button>
                            </>
                          ) : (
                            <a href={href} className="block text-right">
                              <p className="font-bold text-[var(--color-text)]">
                                NPR {log.amount.toLocaleString()}
                              </p>
                              <p className="text-[10px] text-[var(--color-text-muted)]">
                                {timeAgo(log.created_at)}
                              </p>
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </PullToRefresh>
      )}

      {/* ================================================================ */}
      {/* QR Modal — instant popup for showing the shop QR code */}
      {/* ================================================================ */}
      {showQRModal && merchantProfile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={handleCloseQR}
        >
          <div
            className="relative bg-white rounded-3xl p-6 mx-4 max-w-sm w-full shadow-2xl animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close X button */}
            <button
              onClick={handleCloseQR}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full shadow-lg border border-gray-100 flex items-center justify-center active:scale-90 transition-transform text-gray-400 hover:text-gray-600"
              aria-label="Close QR"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="text-center mb-2">
              <h2 className="text-lg font-bold text-[var(--color-text)]">
                {merchantProfile.name}
              </h2>
              <p className="text-sm text-[var(--color-text-muted)] capitalize">
                {merchantProfile.business_type} Shop
              </p>
            </div>

            <QRDisplay
              merchantId={merchantProfile.id}
              merchantName={merchantProfile.name}
              businessType={merchantProfile.business_type}
            />

            <div className="bg-[var(--color-primary)]/10 rounded-xl p-4 mt-4">
              <p className="text-sm text-[var(--color-text)] text-center font-medium leading-relaxed">
                ग्राहकलाई यो क्युआर स्क्यान गर्न लगाउनुहोस्
              </p>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
