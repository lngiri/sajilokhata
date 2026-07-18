"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import BottomNav from "@/components/BottomNav";
import SyncStatus from "@/components/SyncStatus";
import SmsReminderModal from "@/components/SmsReminderModal";
import PullToRefresh from "@/components/PullToRefresh";
import MerchantOnboardingModal from "@/components/MerchantOnboardingModal";
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
import { getCurrentMerchantId, signOut } from "@/lib/auth";
import { getMerchantSmsBalance } from "@/app/actions/sms-billing";
import { useRouter } from "next/navigation";
import TransactionIcon from "@/components/TransactionIcon";
import RoleSwitcher from "@/components/RoleSwitcher";
import OtherRolePrompt from "@/components/OtherRolePrompt";

/** Polling interval for auto-refreshing pending approvals (in ms) */
const POLL_INTERVAL = 300_000;

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
  photo_url?: string | null;
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
  const [showOnboarding, setShowOnboarding] = useState(false);
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
  const [showSmsReminderModal, setShowSmsReminderModal] = useState(false);
  const [reminderCustomer, setReminderCustomer] = useState<{
    customer_id: string;
    customer_name: string | null;
    customer_phone: string;
    current_balance: number;
  } | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const mountedRef = useRef(true);
  const merchantIdRef = useRef<string | null>(null);

  const topPendingLogs = useMemo(() => pendingLogs.slice(0, 3), [pendingLogs]);
  const topActivity = useMemo(() => recentActivity.slice(0, 3), [recentActivity]);
  const displayedActivity = useMemo(() => recentActivity.slice(0, 10), [recentActivity]);

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
    const id = merchantIdRef.current || (await getCurrentMerchantId());
    if (!mountedRef.current) return;

    if (merchantIdRef.current !== id) {
      merchantIdRef.current = id;
      setMerchantId(id);
    }

      if (id) {
        try {
          const [statsData, pendingData, editRequestedData, activityData, profileData, customersData] = await Promise.all([
            getMerchantStats(id),
            getMerchantCreditLogs(id, { status: "pending", limit: 10, columns: "id, amount, type, status, description, created_at, attachment_url, customer_id, customers(name, phone)" }),
            getMerchantCreditLogs(id, { status: "edit_requested", limit: 10, columns: "id, amount, type, status, description, proposed_amount, created_at, customer_id, customers(name, phone)" }),
            getMerchantCreditLogs(id, { limit: 15, columns: "id, amount, type, status, description, created_at, customer_id, customers(name, phone)" }),
            getMerchantProfile(id, "id, name, business_type, business_name, phone, address, photo_url").catch(() => null),
            getMerchantCustomers(id).catch(() => []),
          ]);
        if (!mountedRef.current) return;
        setStats(statsData);
        setPendingLogs([...pendingData, ...editRequestedData] as typeof pendingLogs);
        setRecentActivity(activityData as typeof recentActivity);
        setMerchantProfile(profileData);
        if (profileData && (!profileData.name || !profileData.address || !profileData.business_type)) {
          setShowOnboarding(true);
        }
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

  // Close notification dropdown on click outside (mobile & desktop)
  useEffect(() => {
    if (!showNotifications) return;
    const handler = (e: PointerEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowNotifications(false);
    };
    document.addEventListener("pointerdown", handler);
    window.addEventListener("keydown", escHandler);
    return () => {
      document.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", escHandler);
    };
  }, [showNotifications]);

  // Close profile menu on click outside + Escape
  useEffect(() => {
    if (!showProfileMenu) return;
    const handler = (e: PointerEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowProfileMenu(false);
    };
    document.addEventListener("pointerdown", handler);
    window.addEventListener("keydown", escHandler);
    return () => {
      document.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", escHandler);
    };
  }, [showProfileMenu]);

  // ================================================================
  // Supabase Realtime — listen for INSERT + UPDATE on credit_logs
  // ================================================================
  useEffect(() => {
    if (!merchantId) return;

    const channel = supabase
      .channel("merchant-dashboard")
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

  const handleOnboardingComplete = useCallback(async () => {
    setShowOnboarding(false);
    if (merchantId) {
      const profile = await getMerchantProfile(merchantId, "id, name, business_type, business_name, phone, address, photo_url").catch(() => null);
      setMerchantProfile(profile);
    }
  }, [merchantId]);

  return (
    <>
      {showOnboarding && merchantProfile && (
        <MerchantOnboardingModal
          merchantId={merchantProfile.id}
          currentName={merchantProfile.name || ""}
          currentAddress={merchantProfile.address ?? null}
          currentBusinessType={merchantProfile.business_type || ""}
          onComplete={handleOnboardingComplete}
        />
      )}
      <div className="pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={handleBrandingRefresh}
            className="text-left active:scale-95 transition-transform flex-1 min-w-0"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm flex-shrink-0">
                <span className="text-sm font-bold text-white tracking-tight">QR</span>
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-bold text-[var(--color-text)] truncate leading-tight">
                  {merchantProfile?.name || "QR Hisab"}
                </h1>
                <p className="text-[10px] text-emerald-600 truncate leading-tight flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  {merchantProfile?.business_name?.trim() || merchantProfile?.name || "Shop"}{merchantProfile?.address ? ` · ${merchantProfile.address}` : ""}
                </p>
              </div>
            </div>
          </button>
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            {isRefreshing ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-blue-200 bg-blue-50">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-[10px] font-medium text-blue-600">Syncing...</span>
              </div>
            ) : (
              <>
                {merchantProfile && (
                  <button
                    onClick={() => setShowProfileMenu(true)}
                    className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold shadow-sm active:scale-90 transition-transform overflow-hidden flex-shrink-0"
                  >
                    {merchantProfile.photo_url ? (
                      <img
                        src={merchantProfile.photo_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      (merchantProfile.name || "S").charAt(0).toUpperCase()
                    )}
                  </button>
                )}
                <a
                  href="/merchant/billing"
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-semibold border border-emerald-200 active:scale-95 transition-transform"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839 2.51l-4.66-2.51m0 0l-1.023-.55a2.25 2.25 0 00-2.134 0l-1.022.55m0 0l-4.661 2.51m16.5 1.615a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V9.844a2.25 2.25 0 011.183-1.981l6.478-3.488m8.839 2.51l-4.66-2.51" />
                  </svg>
                  {smsBalance ?? 0} SMS
                </a>
                <div ref={notificationRef}>
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="p-1.5 active:scale-90 transition-transform relative"
                  >
                    <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                    </svg>
                    {pendingLogs.length > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
                    )}
                  </button>
                </div>
                <SyncStatus />
                <RoleSwitcher />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Notification dropdown (outside sticky header to avoid stacking context issues) */}
      {showNotifications && (
        <div
          className="fixed right-4 top-16 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-[100] animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-[var(--color-text)]">Notifications</p>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {pendingLogs.length > 0 ? (
              topPendingLogs.map((log) => (
                <a
                  key={log.id}
                  href="/merchant/ledger"
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-amber-600">!</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[var(--color-text)] truncate">
                      {log.customers?.name || log.customers?.phone || "Unknown"} requested Rs. {log.amount.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-muted)]">
                      {timeAgo(log.created_at)}
                    </p>
                  </div>
                </a>
              ))
            ) : recentActivity.length > 0 ? (
              topActivity.map((log) => (
                <a
                  key={log.id}
                  href="/merchant/ledger"
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-gray-500">
                      {(log.customers?.name || log.customers?.phone || "?").charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[var(--color-text)] truncate">
                      {log.customers?.name || log.customers?.phone || "Unknown"} — {log.type === "debit" ? "Debit" : log.type === "credit" ? "Payment" : "Cash"}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-muted)]">
                      Rs. {log.amount.toLocaleString()} · {timeAgo(log.created_at)}
                    </p>
                  </div>
                </a>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
                No notifications
              </div>
            )}
          </div>
          <a
            href="/merchant/ledger"
            className="block text-center text-xs font-medium text-[var(--color-primary)] py-3 border-t border-gray-100 hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            View All
          </a>
        </div>
      )}

      {/* Profile menu modal */}
      {showProfileMenu && merchantProfile && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowProfileMenu(false)}
        >
          <div
            ref={profileMenuRef}
            onClick={(e) => e.stopPropagation()}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-sm bg-white rounded-2xl shadow-2xl border border-gray-100 max-h-[85vh] overflow-y-auto animate-scale-up"
          >
            {/* Close button */}
            <button
              onClick={() => setShowProfileMenu(false)}
              className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-600 active:scale-90 transition-transform z-10"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Avatar + name header */}
            <div className="flex flex-col items-center pt-8 pb-4 px-6 border-b border-gray-50">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xl font-bold shadow-md mb-3 overflow-hidden">
                {merchantProfile.photo_url ? (
                  <img src={merchantProfile.photo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  (merchantProfile.name || "S").charAt(0).toUpperCase()
                )}
              </div>
              <p className="text-base font-bold text-[var(--color-text)] text-center truncate max-w-full">
                {merchantProfile.name || "Shop"}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5 font-mono">
                {merchantProfile.phone || ""}
              </p>
              {merchantProfile.business_name && (
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  {merchantProfile.business_name}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="p-4 space-y-2">
              <a
                href="/merchant/settings"
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-[var(--color-text)] hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a17.933 17.933 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
                Edit Profile
              </a>

              <a
                href="/merchant/billing"
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-[var(--color-text)] hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839 2.51l-4.66-2.51m0 0l-1.023-.55a2.25 2.25 0 00-2.134 0l-1.022.55m0 0l-4.661 2.51m16.5 1.615a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V9.844a2.25 2.25 0 011.183-1.981l6.478-3.488m8.839 2.51l-4.66-2.51" />
                </svg>
                SMS Balance: {smsBalance ?? 0} credits
              </a>

              <button
                onClick={async () => {
                  setShowProfileMenu(false);
                  await signOut();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Business Name Prompt */}
      {!loading && merchantProfile && (
        (() => {
          const name = merchantProfile.name?.trim();
          const needsUpdate = !name || name.toLowerCase() === "shop";
          if (!needsUpdate) return null;
          return (
            <div className="mx-4 mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-blue-900">
                    Please update your business name from &apos;Shop&apos; to your actual shop name so your customers recognize you on QR Hisab!
                  </p>
                  <a
                    href="/merchant/settings"
                    className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium active:scale-[0.97] transition-transform hover:bg-blue-700"
                  >
                    Update Profile Now
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          );
        })()
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
                        onClick={() => {
                          setReminderCustomer({
                            customer_id: rc.customer_id,
                            customer_name: rc.customer_name,
                            customer_phone: rc.customer_phone,
                            current_balance: rc.current_balance,
                          });
                          setShowSmsReminderModal(true);
                        }}
                        className="px-3 py-1.5 bg-[var(--color-primary)] text-white rounded-lg text-xs font-medium active:scale-[0.97] transition-transform flex items-center gap-1.5 flex-shrink-0"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                        </svg>
                        Remind
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
                  {displayedActivity.map((log) => {
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

      {merchantId && reminderCustomer && (
        <SmsReminderModal
          open={showSmsReminderModal}
          onClose={() => { setShowSmsReminderModal(false); setReminderCustomer(null); }}
          merchantId={merchantId}
          merchantName={merchantProfile?.name || "Shop"}
          customerId={reminderCustomer.customer_id}
          customerName={reminderCustomer.customer_name}
          customerPhone={reminderCustomer.customer_phone}
          balance={reminderCustomer.current_balance}
          smsBalance={smsBalance ?? 0}
        />
      )}

      <BottomNav />
      <OtherRolePrompt currentRole="merchant" />
    </div>
    </>
  );
}
