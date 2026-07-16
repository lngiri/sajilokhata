"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import BottomNav from "@/components/BottomNav";
import SyncStatus from "@/components/SyncStatus";
import PullToRefresh from "@/components/PullToRefresh";
import { useToast } from "@/components/Toast";
import { playSuccessSound } from "@/lib/sound";
import { createClient } from "@/lib/supabase/client";
import {
  getMerchantStats,
  getMerchantCreditLogs,
  getMerchantProfile,
  getMerchantCustomers,
  sendPaymentReminder,
  checkAndSendAutoReminders,
  updateCreditLogStatus,
} from "@/app/actions/merchant";
import {
  acceptEditRequest,
  rejectEditRequest,
} from "@/lib/actions";
import { getCurrentMerchantId } from "@/lib/auth";
import { getMerchantSmsBalance } from "@/app/actions/sms-billing";
import { useRouter } from "next/navigation";
import TransactionIcon from "@/components/TransactionIcon";
import RoleSwitcher from "@/components/RoleSwitcher";
import OtherRolePrompt from "@/components/OtherRolePrompt";

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
  address?: string | null;
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
    totalCashSales: number;
    totalSales: number;
    cashInHand: number;
  } | null>(null);
  const [pendingLogs, setPendingLogs] = useState<
    {
      id: string;
      amount: number;
      type: "debit" | "credit" | "cash";
      status: string;
      description: string | null;
      proposed_amount: number | null;
      created_at: string;
      attachment_url: string | null;
      customer_id: string | null;
      customers: { name: string | null; phone: string } | null;
    }[]
  >([]);
  const [recentActivity, setRecentActivity] = useState<
    {
      id: string;
      amount: number;
      type: "debit" | "credit" | "cash";
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
  const [topReceivables, setTopReceivables] = useState<Array<{
    customer_id: string;
    customer_name: string | null;
    customer_phone: string;
    current_balance: number;
  }>>([]);
  const [remindingCustomerId, setRemindingCustomerId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [smsBalance, setSmsBalance] = useState<number | null>(null);
  const router = useRouter();
  const mountedRef = useRef(true);
  const merchantIdRef = useRef<string | null>(null);



  // Show welcome toast based on account status from login redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    if (status === "new") {
      addToast("Welcome! Your new shop has been registered.", "success");
    } else if (status === "existing") {
      addToast("Welcome back! Your existing account has been loaded.", "success");
    }
    if (status) {
      window.history.replaceState({}, "", "/merchant/dashboard");
    }
  }, [addToast]);

  const supabase = useRef(createClient()).current;

  const loadData = useCallback(async () => {
    let id = merchantIdRef.current || (await getCurrentMerchantId());
    if (!mountedRef.current) return;

    // Cross-check against authoritative Supabase auth session.
    // If the stored merchant_id differs from the actual auth.uid(),
    // it means localStorage is stale — use the auth session ID instead.
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.id !== id) {
        id = user.id;
        localStorage.setItem("merchant_id", user.id);
      }
    } catch {
      // Auth unavailable (bypass/demo mode); keep the existing value
    }

    setMerchantId(id);
    merchantIdRef.current = id;

      if (id) {
        try {
          const [statsData, pendingData, editRequestedData, activityData, profileData, customersData] = await Promise.all([
            getMerchantStats(id),
            getMerchantCreditLogs(id, { status: "pending", limit: 10, columns: "id, amount, type, status, description, created_at, attachment_url, customer_id, customers(name, phone)" }),
            getMerchantCreditLogs(id, { status: "edit_requested", limit: 10, columns: "id, amount, type, status, description, proposed_amount, created_at, customer_id, customers(name, phone)" }),
            getMerchantCreditLogs(id, { limit: 15, columns: "id, amount, type, status, description, created_at, customer_id, customers(name, phone)" }),
            getMerchantProfile(id, "id, name, business_type, business_name, phone, address").catch(() => null),
            getMerchantCustomers(id).catch(() => []),
          ]);
        if (!mountedRef.current) return;
        setStats(statsData);
        setPendingLogs([...pendingData, ...editRequestedData] as typeof pendingLogs);
        setRecentActivity(activityData as typeof recentActivity);
        setMerchantProfile(profileData);
        setTopReceivables(
          ((customersData as any[]) || [])
            .filter(c => (c.current_balance || 0) > 0)
            .sort((a, b) => (b.current_balance || 0) - (a.current_balance || 0))
            .slice(0, 5)
            .map(c => ({
              customer_id: c.customer_id,
              customer_name: c.customers?.name || null,
              customer_phone: c.customers?.phone || "",
              current_balance: c.current_balance || 0,
            }))
        );
        setLastRefreshed(new Date());
        setLoadError(false);

        // Load SMS balance silently
        getMerchantSmsBalance(id).then(setSmsBalance).catch(() => {});

        // Check auto reminders silently
        checkAndSendAutoReminders(id).catch(() => {});
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
            `📥 New credit request: Rs. ${Number(payload.new?.amount || 0).toLocaleString()} — ${customerName}`,
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
              `📝 Entry ${newStatus}: Rs. ${Number(payload.new?.amount || 0).toLocaleString()}`,
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
    try {
      await loadData();
    } catch {
      // Silent — data already refreshed
    }
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
            className="text-left active:scale-95 transition-transform flex-1 min-w-0"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] flex items-center justify-center shadow-sm flex-shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-bold text-[var(--color-text)] truncate leading-tight">
                  {merchantProfile?.name || "QR Hisab"}
                </h1>
                <p className="text-[10px] text-[var(--color-text-muted)] truncate leading-tight">
                  {merchantProfile?.address || merchantProfile?.business_type || ""}
                </p>
                <p className="text-[9px] text-[var(--color-text-muted)] mt-0.5">
                  {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "Asia/Kathmandu" })}
                </p>
                <span className="text-[8px] text-[var(--color-primary)] font-medium opacity-60">A Digital Copy</span>
              </div>
            </div>
          </button>
          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
            {isRefreshing ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-blue-200 bg-blue-50">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-[10px] font-medium text-blue-600">Syncing...</span>
              </div>
            ) : (
              <SyncStatus />
            )}
            <RoleSwitcher />
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

      {loadError && !loading && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
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
      )}

      <PullToRefresh onRefresh={handlePullRefresh}>
        <div className="px-4 py-4 space-y-4">
          {/* Stats Cards */}
          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50">
                  <div className="h-3 w-16 bg-gray-100 rounded animate-pulse mb-2" />
                  <div className="h-6 w-24 bg-gray-200 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : stats && (
            <div className="grid grid-cols-2 gap-3">
              <a href="/merchant/logs" className="block bg-white rounded-2xl p-4 shadow-sm border border-gray-50 active:scale-[0.98] transition-transform">
                <p className="text-xs text-[var(--color-text-muted)] mb-1">Outstanding</p>
                <p className="text-xl font-bold text-[var(--color-danger)]">Rs. {stats.totalOutstanding.toLocaleString()}</p>
              </a>
              <a href="/merchant/logs" className="block bg-white rounded-2xl p-4 shadow-sm border border-gray-50 active:scale-[0.98] transition-transform">
                <p className="text-xs text-[var(--color-text-muted)] mb-1">Today</p>
                <p className="text-xl font-bold text-[var(--color-primary)]">Rs. {stats.todayTotal.toLocaleString()}</p>
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
          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50">
                  <div className="h-3 w-16 bg-gray-100 rounded animate-pulse mb-2" />
                  <div className="h-6 w-20 bg-gray-200 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : stats && (
            <div className="grid grid-cols-2 gap-3">
              <a href="/merchant/scan?manual=true" className="block bg-white rounded-2xl p-4 shadow-sm border border-gray-50 active:scale-[0.98] transition-transform">
                <p className="text-xs text-[var(--color-text-muted)] mb-1">Total Sales</p>
                <p className="text-xl font-bold text-blue-600">Rs. {stats.totalSales.toLocaleString()}</p>
              </a>
              <a href="/merchant/logs" className="block bg-white rounded-2xl p-4 shadow-sm border border-gray-50 active:scale-[0.98] transition-transform">
                <p className="text-xs text-[var(--color-text-muted)] mb-1">Cash In Hand</p>
                <p className="text-xl font-bold text-green-600">Rs. {stats.cashInHand.toLocaleString()}</p>
              </a>
            </div>
          )}

            {/* Low SMS Balance Warning */}
            {smsBalance !== null && smsBalance <= 5 && (
              <a
                href="/merchant/billing"
                className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl active:scale-[0.98] transition-transform"
              >
                <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-amber-800">SMS Balance Low</p>
                  <p className="text-xs text-amber-700">{smsBalance} credit{smsBalance !== 1 ? "s" : ""} remaining — Recharge to continue sending reminders</p>
                </div>
                <svg className="w-4 h-4 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </a>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-3">
              <a
                href="/merchant/scan?manual=true"
                className="flex items-center justify-center gap-2 py-3 bg-[var(--color-primary)] text-white rounded-xl font-medium text-sm active:scale-[0.98] transition-transform"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Manual Entry
              </a>
              <a
                href="/merchant/reports"
                className="flex items-center justify-center gap-2 py-3 bg-white text-[var(--color-text)] border border-gray-200 rounded-xl font-medium text-sm active:scale-[0.98] transition-transform"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Reports
              </a>
            </div>

            {/* Cash Sales Ledger Entry */}
            <a
              href="/merchant/cash-sales"
              className="block bg-white rounded-2xl p-4 shadow-sm border border-gray-50 active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-[var(--color-text)]">Cash Sales Ledger</p>
                  <p className="text-xs text-[var(--color-text-muted)]">View history of all cash transactions</p>
                </div>
                <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </a>

            {/* Smart Receivables Section */}
            {topReceivables.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-[var(--color-text)]">
                    Receivables
                  </h2>
                  <a
                    href="/merchant/customers"
                    className="text-xs text-[var(--color-primary)] font-medium active:opacity-70"
                  >
                    View All Customers →
                  </a>
                </div>
                <div className="space-y-2">
                  {topReceivables.map((rc) => (
                    <div
                      key={rc.customer_id}
                      className="bg-white rounded-xl p-3.5 shadow-sm border border-gray-50 flex items-center gap-3"
                    >
                      <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-red-600">
                          {(rc.customer_name || rc.customer_phone).charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <a href={`/merchant/customers/${rc.customer_id}`} className="block">
                          <p className="font-medium text-sm text-[var(--color-text)] truncate">
                            {rc.customer_name || rc.customer_phone}
                          </p>
                          <p className="text-xs text-[var(--color-danger)] font-semibold">
                            Rs. {rc.current_balance.toLocaleString()}
                          </p>
                        </a>
                      </div>
                      <button
                        onClick={async () => {
                          if (!merchantId) return;
                          setRemindingCustomerId(rc.customer_id);
                          try {
                            const result = await sendPaymentReminder(merchantId, rc.customer_id, "sms");
                            if (result.success) {
                              addToast("Reminder sent!", "success");
                            } else {
                              addToast(result.error || "Failed", "error");
                            }
                          } catch {
                            addToast("Failed to send reminder", "error");
                          } finally {
                            setRemindingCustomerId(null);
                          }
                        }}
                        disabled={remindingCustomerId === rc.customer_id}
                        className="px-3 py-1.5 bg-[var(--color-primary)] text-white rounded-lg text-xs font-medium active:scale-[0.97] transition-transform disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0"
                      >
                        {remindingCustomerId === rc.customer_id ? (
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                            </svg>
                            Remind
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Customer Activity Feed */}
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
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${log.type === "debit" ? "bg-red-50" : log.type === "cash" ? "bg-blue-50" : "bg-green-50"}`}>
                          <TransactionIcon type={log.type} size={14} className={log.type === "debit" ? "text-red-600" : log.type === "cash" ? "text-blue-600" : "text-green-600"} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm text-[var(--color-text)] truncate">
                              {log.type === "cash" ? "Cash Sale" : (log.customers?.name || log.customers?.phone || "Unknown")}
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
                          <p className={`font-bold text-xs ${log.status === "rejected" ? "text-slate-400 line-through" : log.type === "debit" ? "text-red-600" : log.type === "cash" ? "text-blue-600" : "text-green-600"}`}>
                            {log.type === "cash" ? "" : (log.type === "debit" ? "+" : "-")}Rs. {log.amount.toLocaleString()}
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
                          isEditRequest ? "border-blue-200 bg-blue-50/30" : log.attachment_url ? "border-purple-200 bg-purple-50/30" : "border-gray-50"
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${log.type === "debit" ? "bg-red-50" : log.type === "cash" ? "bg-blue-50" : "bg-green-50"}`}>
                          <TransactionIcon type={log.type} size={16} className={log.type === "debit" ? "text-red-600" : log.type === "cash" ? "text-blue-600" : "text-green-600"} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm text-[var(--color-text)] truncate">
                              {log.type === "cash" ? "Cash Sale" : (log.customers?.name || log.customers?.phone || "Unknown")}
                            </p>
                            {log.attachment_url && (
                              <span className="text-[10px] font-medium text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                Voucher
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[var(--color-text-muted)] truncate">
                            {log.description || "No description"}
                          </p>
                          {isEditRequest && log.proposed_amount && (
                            <p className="text-xs text-blue-700 font-medium mt-1">
                              Customer requested amount change from Rs. {log.amount.toLocaleString()} to Rs. {log.proposed_amount.toLocaleString()}
                            </p>
                          )}
                          {log.attachment_url && (
                            <button
                              onClick={() => setPreviewImage(log.attachment_url)}
                              className="mt-1 inline-flex items-center gap-1 text-xs text-purple-600 font-medium active:opacity-70"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                              </svg>
                              View Screenshot
                            </button>
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
                                Accept
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
                                Reject
                              </button>
                            </>
                          ) : log.attachment_url ? (
                            <>
                              <button
                                onClick={async () => {
                                  try {
                                    await updateCreditLogStatus(log.id, "approved");
                                    addToast("Voucher approved! Balance updated.", "success");
                                    loadData();
                                  } catch {
                                    addToast("Failed to approve", "error");
                                  }
                                }}
                                className="w-full px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium active:scale-[0.97] transition-transform"
                              >
                                Approve
                              </button>
                              <button
                                onClick={async () => {
                                  try {
                                    await updateCreditLogStatus(log.id, "rejected");
                                    addToast("Voucher rejected", "success");
                                    loadData();
                                  } catch {
                                    addToast("Failed to reject", "error");
                                  }
                                }}
                                className="w-full px-3 py-1.5 bg-gray-200 text-gray-600 rounded-lg text-xs font-medium active:scale-[0.97] transition-transform"
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <a href={href} className="block text-right">
                              <p className="font-bold text-[var(--color-text)]">
                                Rs. {log.amount.toLocaleString()}
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

      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white z-10"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={previewImage}
            alt="Payment voucher screenshot"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <BottomNav />
      <OtherRolePrompt currentRole="merchant" />
    </div>
  );
}
