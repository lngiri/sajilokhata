"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import BottomNav from "@/components/BottomNav";

import SmsReminderModal from "@/components/SmsReminderModal";
import PullToRefresh from "@/components/PullToRefresh";
import MerchantOnboardingModal from "@/components/MerchantOnboardingModal";
import { useToast } from "@/components/Toast";
import { playSuccessSound } from "@/lib/sound";
import { createClient } from "@/lib/supabase/client";
import {
  getMerchantDashboardData,
  sendPaymentReminder,
  checkAndSendAutoReminders,
  updateCreditLogStatus,
} from "@/app/actions/merchant";
import {
  acceptEditRequest,
  rejectEditRequest,
} from "@/lib/actions";
import {
  getNotifications as getNotifs,
  getUnreadCount,
  markAsRead,
} from "@/app/actions/notifications";
import { getCurrentMerchantId, signOut } from "@/lib/auth";
import { getMerchantSmsBalance } from "@/app/actions/sms-billing";
import { useRouter } from "next/navigation";
import TransactionIcon from "@/components/TransactionIcon";
import RoleSwitcher from "@/components/RoleSwitcher";
import OtherRolePrompt from "@/components/OtherRolePrompt";
import LogoWithAbout from "@/components/LogoWithAbout";

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
    awaitingCount: number;
    todayTotal: number;
    totalCashSales: number;
    totalSales: number;
    cashInHand: number;
    todayCreditSales: number;
    totalExpenses: number;
  } | null>(null);
  const [awaitingLogs, setPendingLogs] = useState<
    {
      id: string;
      amount: number;
      type: "debit" | "credit" | "cash" | "expense";
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
      type: "debit" | "credit" | "cash" | "expense";
      status: string;
      description: string | null;
      created_at: string;
      customers: { name: string | null; phone: string } | null;
    }[]
  >([]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  const [customersLoading, setCustomersLoading] = useState(true);
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
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const mountedRef = useRef(true);
  const merchantIdRef = useRef<string | null>(null);
  const onboardedRef = useRef(false);

  const topAwaitingLogs = useMemo(() => awaitingLogs.slice(0, 3), [awaitingLogs]);
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

  // Fire-and-forget non-critical loads
  const loadBackground = useCallback((id: string) => {
    getMerchantSmsBalance(id).then(setSmsBalance).catch(() => {});
    checkAndSendAutoReminders(id).catch(() => {});
  }, []);

  /** Load all dashboard data in a single server round-trip */
  const loadData = useCallback(async () => {
    const id = merchantIdRef.current || (await getCurrentMerchantId());
    if (!mountedRef.current) return;

    if (merchantIdRef.current !== id) {
      merchantIdRef.current = id;
      setMerchantId(id);
    }

    if (!id) return;

    try {
      const data = await getMerchantDashboardData(id);
      if (!mountedRef.current) return;

      setMerchantProfile(data.profile);
      setStats(data.stats);
      setPendingLogs(data.awaitingLogs as typeof awaitingLogs);
      setRecentActivity(data.recentActivity as typeof recentActivity);
      setTopReceivables(data.topReceivables);
      setLastRefreshed(new Date());
      setLoadError(false);

      if (data.profile) {
        const nameOk = !!data.profile.name?.trim();
        const addrOk = !!data.profile.address?.trim();
        const typeOk = !!data.profile.business_type?.trim();
        const isComplete = nameOk && addrOk && typeOk;
        let dismissed = false;
        try { dismissed = localStorage.getItem(`merchant_onboarded_${id}`) === "1"; } catch { /* ignore */ }
        if (!isComplete && !dismissed && !onboardedRef.current) {
          setShowOnboarding(true);
        }
      }
    } catch {
      if (mountedRef.current) setLoadError(true);
    } finally {
      if (mountedRef.current) {
        setProfileLoading(false);
        setStatsLoading(false);
        setCustomersLoading(false);
      }
    }

    loadBackground(id);
  }, [loadBackground]);

  const loadNotifications = useCallback(async () => {
    const id = merchantIdRef.current;
    if (!id) return;
    const [notifData, unread] = await Promise.all([
      getNotifs(id, "merchant", 10),
      getUnreadCount(id, "merchant"),
    ]);
    if (mountedRef.current) {
      setNotifications(notifData);
      setUnreadNotifCount(unread);
    }
  }, []);

  // Initial load + polling
  useEffect(() => {
    mountedRef.current = true;
    loadData();
    loadNotifications();

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadData();
        loadNotifications();
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
  // Realtime — listen for INSERT + UPDATE on credit_logs + notifications
  // ================================================================
  useEffect(() => {
    if (!merchantId) return;

    const notifChannel = supabase
      .channel("merchant-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${merchantId}`,
        },
        () => {
          if (mountedRef.current) loadNotifications();
        }
      )
      .subscribe();

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
      supabase.removeChannel(notifChannel);
    };
  }, [merchantId, addToast, loadData, loadNotifications, supabase]);

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
        return "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20";
      case "pending":
      case "awaiting_confirmation":
        return "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30";
      case "rejected":
        return "text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-900/30";
      case "disputed":
        return "text-[var(--color-danger)] bg-[var(--color-danger)]/10";
      default:
        return "text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800";
    }
  };

  const handleOnboardingComplete = useCallback((data?: { name: string; address: string; business_type: string }) => {
    onboardedRef.current = true;
    setShowOnboarding(false);
    // Persist onboarded state so remounts don't re-trigger the modal
    try {
      const mid = merchantIdRef.current || merchantId;
      if (mid) localStorage.setItem(`merchant_onboarded_${mid}`, "1");
    } catch { /* ignore */ }
    // Immediately update profile state so the completeness check passes
    if (data) {
      setMerchantProfile(prev => prev ? { ...prev, ...data } : prev);
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
      <div className="sticky top-0 z-40 bg-[var(--color-bg)]/80 backdrop-blur-md border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between px-3 py-2.5 min-h-[56px]">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <LogoWithAbout size={32} showAnimation={false} />
            <button
              onClick={handleBrandingRefresh}
              className="text-left active:scale-95 transition-transform min-w-0"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-[var(--color-text)] truncate max-w-[180px] sm:max-w-[260px] leading-tight">
                  {merchantProfile?.business_name?.trim() || merchantProfile?.name || "Shop"}
                </span>
                <RoleSwitcher compact />
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-[var(--color-text-muted)] truncate leading-tight mt-0.5">
                {merchantProfile?.phone && <span className="font-mono">{merchantProfile.phone}</span>}
                {merchantProfile?.phone && merchantProfile?.address && <span className="text-[var(--color-border)]">|</span>}
                {merchantProfile?.address && <span className="truncate">{merchantProfile.address}</span>}
              </div>
            </button>
          </div>
          <div className="flex items-center gap-0 flex-shrink-0">
            <a
              href="/merchant/billing"
              className="flex items-center justify-center w-[44px] h-[44px] active:scale-90 transition-transform"
              aria-label={`${smsBalance ?? 0} SMS credits`}
            >
              <div className="flex items-center gap-1 px-2 py-1.5 bg-[var(--color-primary)]/5 text-[var(--color-primary-dark)] rounded-full text-[10px] font-semibold border border-[var(--color-primary)]/20">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839 2.51l-4.66-2.51m0 0l-1.023-.55a2.25 2.25 0 00-2.134 0l-1.022.55m0 0l-4.661 2.51m16.5 1.615a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V9.844a2.25 2.25 0 011.183-1.981l6.478-3.488m8.839 2.51l-4.66-2.51" />
                </svg>
                {smsBalance ?? 0}
              </div>
            </a>
            <div ref={notificationRef}>
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications && merchantId) {
                    markAsRead(merchantId, "merchant").then(() => {
                      setUnreadNotifCount(0);
                      loadNotifications();
                    }).catch(() => {});
                  }
                }}
                className="flex items-center justify-center w-[44px] h-[44px] active:scale-90 transition-transform relative"
                aria-label="Notifications"
              >
                <svg className="w-5 h-5 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
                {unreadNotifCount > 0 && (
                  <span className="absolute top-0 right-0 min-w-[18px] h-[18px] flex items-center justify-center bg-blue-500 text-white text-[10px] font-bold rounded-full border-2 border-white px-1">
                    {unreadNotifCount}
                  </span>
                )}
                {unreadNotifCount === 0 && awaitingLogs.length > 0 && (
                  <span className="absolute top-0 right-0 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white px-1 animate-pulse-soft">
                    {awaitingLogs.length}
                  </span>
                )}
              </button>
            </div>
            <button
              onClick={() => setShowProfileMenu(true)}
              className="flex items-center justify-center w-[44px] h-[44px] active:scale-90 transition-transform"
              aria-label="Menu"
            >
              <svg className="w-5 h-5 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Notification dropdown (outside sticky header to avoid stacking context issues) */}
      {showNotifications && (
        <div
          className="fixed right-4 top-16 w-72 bg-[var(--color-surface)] rounded-2xl shadow-xl border border-[var(--color-border)] overflow-hidden z-[100] animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-3 border-b border-[var(--color-border)] flex items-center justify-between">
            <p className="text-sm font-semibold text-[var(--color-text)]">Notifications</p>
            {notifications.length > 0 && (
              <span className="text-[10px] text-[var(--color-text-muted)]">{notifications.length}</span>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 && awaitingLogs.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
                No notifications
              </div>
            ) : (
              <>
                {/* Pending entries section */}
                {awaitingLogs.length > 0 && (
                  <div className="px-3 pt-2 pb-1">
                    <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">Pending</p>
                  </div>
                )}
                {topAwaitingLogs.map((log) => (
                  <a
                    key={`pending-${log.id}`}
                    href="/merchant/logs"
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-amber-50 dark:hover:bg-amber-900/30 active:bg-amber-100 dark:active:bg-amber-900/50 transition-colors border-l-2 border-amber-400 ml-2"
                  >
                    <div className="w-7 h-7 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-amber-600">!</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[var(--color-text)] truncate">
                        {log.customers?.name || log.customers?.phone || "Unknown"} — Rs. {log.amount.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">{timeAgo(log.created_at)}</p>
                    </div>
                  </a>
                ))}
                {/* Persistent notifications section */}
                {notifications.length > 0 && (
                  <div className="px-3 pt-2 pb-1">
                    <p className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Updates</p>
                  </div>
                )}
                {notifications.slice(0, 5).map((n: any) => (
                  <a
                    key={n.id}
                    href="/merchant/logs"
                    className={`flex items-start gap-3 px-4 py-2.5 hover:bg-[var(--color-surface)]/80 active:bg-[var(--color-surface)] transition-colors ${!n.read ? "bg-blue-50/30 dark:bg-blue-900/20" : ""}`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      n.type === "entry_created" ? "bg-green-100 dark:bg-green-900/40" :
                      n.type === "entry_rejected" ? "bg-red-100 dark:bg-red-900/40" :
                      n.type === "entry_disputed" ? "bg-purple-100 dark:bg-purple-900/40" :
                      n.type === "customer_linked" ? "bg-blue-100 dark:bg-blue-900/40" :
                      "bg-gray-100 dark:bg-gray-800"
                    }`}>
                      <span className={`text-xs font-bold ${
                        n.type === "entry_created" ? "text-green-700 dark:text-green-400" :
                        n.type === "entry_rejected" ? "text-red-700 dark:text-red-400" :
                        n.type === "entry_disputed" ? "text-purple-700 dark:text-purple-400" :
                        n.type === "customer_linked" ? "text-blue-700 dark:text-blue-400" :
                        "text-gray-500 dark:text-gray-400"
                      }`}>
                        {n.type === "entry_created" ? "+" :
                         n.type === "entry_rejected" ? "✗" :
                         n.type === "entry_disputed" ? "!" :
                         n.type === "customer_linked" ? "👤" :
                         "•"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[var(--color-text)] truncate">{n.title}</p>
                      {n.body && <p className="text-[10px] text-[var(--color-text-muted)] truncate">{n.body}</p>}
                      <p className="text-[9px] text-[var(--color-text-muted)] mt-0.5">{timeAgo(n.created_at)}</p>
                    </div>
                  </a>
                ))}
              </>
            )}
          </div>
          <a
            href="/merchant/logs"
            className="block text-center text-xs font-medium text-[var(--color-primary)] py-3 border-t border-[var(--color-border)] hover:bg-[var(--color-surface)]/80 active:bg-[var(--color-surface)] transition-colors"
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
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-sm bg-[var(--color-surface)] rounded-2xl shadow-2xl border border-[var(--color-border)] max-h-[85vh] overflow-y-auto animate-scale-up"
          >
            {/* Close button */}
            <button
              onClick={() => setShowProfileMenu(false)}
              className="absolute top-3 right-3 p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)] active:scale-90 transition-transform z-10"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Avatar + name header */}
            <div className="flex flex-col items-center pt-8 pb-4 px-6 border-b border-[var(--color-border)]">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[var(--color-primary-light)] to-[var(--color-primary-dark)] flex items-center justify-center text-white text-xl font-bold shadow-md mb-3 overflow-hidden">
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
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-surface)]/80 active:bg-[var(--color-surface)] transition-colors"
              >
                <svg className="w-5 h-5 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a17.933 17.933 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
                Edit Profile
              </a>

              <a
                href="/merchant/billing"
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-surface)]/80 active:bg-[var(--color-surface)] transition-colors"
              >
                <svg className="w-5 h-5 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839 2.51l-4.66-2.51m0 0l-1.023-.55a2.25 2.25 0 00-2.134 0l-1.022.55m0 0l-4.661 2.51m16.5 1.615a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V9.844a2.25 2.25 0 011.183-1.981l6.478-3.488m8.839 2.51l-4.66-2.51" />
                </svg>
                SMS Balance: {smsBalance ?? 0} credits
              </a>

              <button
                onClick={async () => {
                  setShowProfileMenu(false);
                  await signOut();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 active:bg-red-100 dark:active:bg-red-900/50 transition-colors"
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

      {/* Business Name Prompt */}
      {!profileLoading && merchantProfile && (
        (() => {
          const name = merchantProfile.name?.trim();
          const needsUpdate = !name || name.toLowerCase() === "shop";
          if (!needsUpdate) return null;
          return (
            <div className="mx-4 mt-4 p-4 bg-gradient-to-r from-blue-50 dark:from-blue-900/20 to-indigo-50 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
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

      {loadError && !statsLoading && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <p className="font-medium text-[var(--color-text)]">Could not load data</p>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Check your connection and try again</p>
          <button
            onClick={loadData}
            className="mt-4 px-6 py-3 bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] rounded-xl text-sm font-medium active:scale-[0.98] transition-transform flex items-center gap-2"
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
          {statsLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-[var(--color-surface)] rounded-2xl p-4 shadow-sm border border-[var(--color-border)]">
                  <div className="h-3 w-16 bg-gray-100 dark:bg-gray-700 rounded animate-pulse mb-2" />
                  <div className="h-6 w-24 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : stats && (
            <div className="grid grid-cols-2 gap-3">
              <a href="/merchant/logs?filter=credit" className="block bg-[var(--color-surface)] rounded-2xl p-4 shadow-sm border border-[var(--color-border)] active:scale-[0.98] transition-transform overflow-hidden">
                <p className="text-xs text-[var(--color-text-muted)] mb-1">Credit on Market</p>
                <p className="text-lg sm:text-xl font-bold text-[var(--color-danger)] truncate">Rs. {stats.totalOutstanding.toLocaleString()}</p>
              </a>
              <a href="/merchant/logs?filter=today" className="block bg-[var(--color-surface)] rounded-2xl p-4 shadow-sm border border-[var(--color-border)] active:scale-[0.98] transition-transform overflow-hidden">
                <p className="text-xs text-[var(--color-text-muted)] mb-1">Today's Due Collection</p>
                <p className="text-lg sm:text-xl font-bold text-[var(--color-primary)] truncate">Rs. {stats.todayTotal.toLocaleString()}</p>
              </a>
              <a href="/merchant/logs?filter=cash" className="block bg-[var(--color-surface)] rounded-2xl p-4 shadow-sm border border-[var(--color-border)] active:scale-[0.98] transition-transform overflow-hidden">
                <p className="text-xs text-[var(--color-text-muted)] mb-1">Today's Cash Sales</p>
                <p className="text-lg sm:text-xl font-bold text-green-600 dark:text-green-400 truncate">Rs. {stats.totalCashSales.toLocaleString()}</p>
              </a>
              <a href="/merchant/logs?filter=debit" className="block bg-[var(--color-surface)] rounded-2xl p-4 shadow-sm border border-[var(--color-border)] active:scale-[0.98] transition-transform overflow-hidden">
                <p className="text-xs text-[var(--color-text-muted)] mb-1">Today Cr. Sales</p>
                <p className="text-lg sm:text-xl font-bold text-amber-600 dark:text-amber-400 truncate">Rs. {(stats.todayCreditSales ?? 0).toLocaleString()}</p>
              </a>
            </div>
          )}
          {statsLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2].map((i) => (
                <div key={i} className="bg-[var(--color-surface)] rounded-2xl p-4 shadow-sm border border-[var(--color-border)]">
                  <div className="h-3 w-16 bg-gray-100 dark:bg-gray-700 rounded animate-pulse mb-2" />
                  <div className="h-6 w-20 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : stats && (
            <div className="grid grid-cols-2 gap-3">
              <a href="/merchant/logs?filter=today" className="block bg-[var(--color-surface)] rounded-2xl p-4 shadow-sm border border-[var(--color-border)] active:scale-[0.98] transition-transform overflow-hidden">
                <p className="text-xs text-[var(--color-text-muted)] mb-1">All Sales</p>
                <p className="text-lg sm:text-xl font-bold text-blue-600 dark:text-blue-400 truncate">Rs. {stats.totalSales.toLocaleString()}</p>
              </a>
              <a href="/merchant/logs?filter=cash" className="block bg-[var(--color-surface)] rounded-2xl p-4 shadow-sm border border-[var(--color-border)] active:scale-[0.98] transition-transform overflow-hidden">
                <p className="text-xs text-[var(--color-text-muted)] mb-1">Cash in Hand</p>
                <p className="text-lg sm:text-xl font-bold text-green-600 dark:text-green-400 truncate">Rs. {stats.cashInHand.toLocaleString()}</p>
              </a>
            </div>
          )}

            {/* Low SMS Balance Warning */}
            {smsBalance !== null && smsBalance <= 5 && (
              <a
                href="/merchant/billing"
                className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl active:scale-[0.98] transition-transform"
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
                className="flex items-center justify-center gap-2 py-3 bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] rounded-xl font-medium text-sm active:scale-[0.98] transition-transform"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Manual Entry
              </a>
              <a
                href="/merchant/products"
                className="flex items-center justify-center gap-2 py-3 bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)] rounded-xl font-medium text-sm active:scale-[0.98] transition-transform"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25-2.25M12 13.875l2.25 2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
                Products
              </a>
            </div>
            <a
              href="/merchant/reports"
              className="flex items-center justify-center gap-2 py-3 bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)] rounded-xl font-medium text-sm active:scale-[0.98] transition-transform"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
              Reports
            </a>

            {/* Add Cash Out (Purchase / Expense) */}
            <a
              href="/merchant/scan?manual=true&type=expense"
              className="flex items-center justify-center gap-2 py-3 bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)] rounded-xl font-medium text-sm active:scale-[0.98] transition-transform"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m3-3H9" />
              </svg>
              Add Cash Out
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
                    className="text-xs text-[var(--color-primary)] font-medium active:opacity-70 py-2"
                  >
                    View All Customers →
                  </a>
                </div>
                <div className="space-y-2">
                  {topReceivables.map((rc) => (
                    <div
                      key={rc.customer_id}
                      className="bg-[var(--color-surface)] rounded-xl p-3.5 shadow-sm border border-[var(--color-border)] flex items-center gap-3"
                    >
                      <div className="w-9 h-9 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-red-600">
                          {(rc.customer_name || rc.customer_phone).charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <a href={`/merchant/customers/${rc.customer_id}`} className="block">
                          <p className="font-medium text-sm text-[var(--color-text)] truncate" title={rc.customer_name || rc.customer_phone}>
                            {rc.customer_name || rc.customer_phone}
                          </p>
                          <p className="text-xs text-[var(--color-danger)] font-semibold">
                            Rs. {rc.current_balance.toLocaleString()}
                          </p>
                        </a>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <a
                          href={`tel:${rc.customer_phone}`}
                          className="p-2.5 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg active:scale-[0.97] transition-transform flex items-center justify-center"
                          aria-label={`Call ${rc.customer_name || rc.customer_phone}`}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                          </svg>
                        </a>
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
                          className="px-2.5 py-2.5 bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] rounded-lg text-xs font-medium active:scale-[0.97] transition-transform flex items-center gap-1.5 flex-shrink-0"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                          </svg>
                        </button>
                      </div>
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
                  <p className="text-sm">No activity yet 📝</p>
                  <p className="text-xs mt-1">Start by adding a customer or making a sale</p>
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
                        className={`block bg-[var(--color-surface)] rounded-xl p-3.5 shadow-sm border border-[var(--color-border)] flex items-center gap-3 active:scale-[0.98] transition-transform ${log.status === "rejected" ? "opacity-60" : ""}`}
                      >
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${log.type === "debit" ? "bg-red-100 dark:bg-red-900/40" : log.type === "expense" ? "bg-orange-100 dark:bg-orange-900/40" : log.type === "cash" ? "bg-blue-100 dark:bg-blue-900/40" : "bg-green-100 dark:bg-green-900/40"}`}>
                          <TransactionIcon type={log.type} size={14} className={log.type === "debit" ? "text-red-700 dark:text-red-400" : log.type === "expense" ? "text-orange-700 dark:text-orange-400" : log.type === "cash" ? "text-blue-700 dark:text-blue-400" : "text-green-700 dark:text-green-400"} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm text-[var(--color-text)] truncate">
                              {log.type === "expense" ? "Cash Out" : log.type === "cash" ? "Cash Sale" : (log.customers?.name || log.customers?.phone || "Unknown")}
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
                          <p className={`font-bold text-xs ${log.status === "rejected" ? "text-slate-400 dark:text-slate-500 line-through" : log.type === "expense" ? "text-orange-700 dark:text-orange-400" : log.type === "debit" ? "text-red-700 dark:text-red-400" : log.type === "cash" ? "text-blue-700 dark:text-blue-400" : "text-green-700 dark:text-green-400"}`}>
                            {log.type === "cash" || log.type === "expense" ? "" : (log.type === "debit" ? "+" : "-")}Rs. {log.amount.toLocaleString()}
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
          </div>
        </PullToRefresh>

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
