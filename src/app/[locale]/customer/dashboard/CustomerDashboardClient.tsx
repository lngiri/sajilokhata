"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useTranslations } from "next-intl";
import PullToRefresh from "@/components/PullToRefresh";
import { QRScanner } from "@/components/QRCode";
import { useToast } from "@/components/Toast";
import { playSuccessSound } from "@/lib/sound";
import AmountSuggestions from "@/components/AmountSuggestions";
import CustomerProductPicker from "@/components/CustomerProductPicker";
import PendingApprovalModal from "@/components/PendingApprovalModal";
import CustomerBottomNav from "@/components/CustomerBottomNav";
import RoleSwitcher from "@/components/RoleSwitcher";
import OtherRolePrompt from "@/components/OtherRolePrompt";
import CustomerPinGate from "@/components/CustomerPinGate";
import LogoWithAbout from "@/components/LogoWithAbout";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import { createClient } from "@/lib/supabase/client";
import { normalizePhone } from "@/lib/phone";
import { formatNumber } from "@/lib/format";
import { isOnline, savePendingLog } from "@/lib/offline/db";
import {
  findOrCreateCustomer,
  getCustomerStats,
  getCustomerIdsForPhone,
} from "@/app/actions/customer";
import { getMerchantPaymentMethodsPublic, submitPaymentVoucher } from "@/app/actions/merchant";
import { getCustomerProfile, submitCustomerEntry } from "@/app/actions/customer";
import {
  getNotifications as getNotifs,
  getUnreadCount,
  markAsRead,
} from "@/app/actions/notifications";
import CustomerOnboardingModal from "@/components/CustomerOnboardingModal";
import OnboardingTour from "@/components/OnboardingTour";
import { CUSTOMER_TOUR_STEPS } from "@/components/tourSteps";
import { fetchWithCache } from "@/lib/offline/cache";

interface Props {
  messages: any;
  locale: string;
}

function maskPhone(phone: string): string {
  if (phone.length < 8) return phone;
  return phone.slice(0, 4) + "****" + phone.slice(-2);
}

const CUSTOMER_STORAGE_KEY = "sajilo_customer_session";

export default function CustomerDashboardClient({ messages, locale }: Props) {
  const t = useTranslations();
  const { addToast } = useToast();

  // Customer identity
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showTour, setShowTour] = useState(false);

  // Stats
  const [stats, setStats] = useState<{
    totalOutstanding: number;
    shopsCount: number;
    totalCreditLimit: number;
    pendingCount: number;
    relationships: Array<{
      current_balance: number;
      credit_limit: number;
      merchants: { id: string; name: string; business_name: string | null } | null;
    }>;
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  // Modal scan flow
  const [showScanner, setShowScanner] = useState(false);
  const [scanStep, setScanStep] = useState<"scan" | "enter" | "success">("scan");
  const [merchantId, setMerchantId] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [entryType, setEntryType] = useState<"debit" | "credit">("debit");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);

  // Edit profile modal
  const [showEditProfile, setShowEditProfile] = useState(false);

  // Voucher upload modal
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [voucherMerchant, setVoucherMerchant] = useState<{ id: string; name: string } | null>(null);
  const [voucherAmount, setVoucherAmount] = useState("");
  const [voucherFile, setVoucherFile] = useState<File | null>(null);
  const [voucherPreview, setVoucherPreview] = useState<string | null>(null);
  const [voucherUploading, setVoucherUploading] = useState(false);

  // Payment methods modal
  const [showPaymentMethods, setShowPaymentMethods] = useState(false);
  const [paymentMethodsMerchant, setPaymentMethodsMerchant] = useState<{ id: string; name: string } | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<Array<{
    method_type: string;
    label: string | null;
    qr_url: string | null;
    account_holder: string | null;
    account_number: string | null;
    bank_name: string | null;
    is_active: boolean;
  }>>([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(false);

  // QR preview lightbox
  const [qrPreviewUrl, setQrPreviewUrl] = useState<string | null>(null);
  const [qrPreviewLabel, setQrPreviewLabel] = useState("");
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [showFullPhone, setShowFullPhone] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showShops, setShowShops] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const customerNotificationRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const closeModalTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined!);
  const onboardingCompletedRef = useRef(false);
  const loadStatsRef = useRef<() => Promise<void>>(undefined!);

  const resizeImage = (file: File, maxDim: number): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        let w = img.width, h = img.height;
        if (w <= maxDim && h <= maxDim) { resolve(file); return; }
        const ratio = Math.min(maxDim / w, maxDim / h);
        w = Math.round(w * ratio); h = Math.round(h * ratio);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob); else reject(new Error("Canvas toBlob failed"));
        }, "image/webp", 0.85);
      };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Image load failed")); };
      img.src = objectUrl;
    });

  // On mount, restore customer session from localStorage (with cookie fallback)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CUSTOMER_STORAGE_KEY);
      if (raw) {
        const session = JSON.parse(raw);
        if (session.phone) {
          setCustomerPhone(session.phone);
          setCustomerName(session.name || "");
          setInitialized(true);
          return;
        }
      }
    } catch {
      // Corrupted localStorage — fall through to cookie
    }

    // Fallback: try to read HMAC-signed customer_session cookie
    try {
      const match = document.cookie
        .split("; ")
        .find((c) => c.startsWith("customer_session="));
      if (match) {
        const raw = decodeURIComponent(match.split("=").slice(1).join("="));
        const parts = raw.split(".");
        if (parts.length >= 4) {
          const phone = parts[0];
          const name = parts.length > 4 ? parts.slice(3, -1).join(".") : "";
          if (phone && String(phone).replace(/\D/g, "").length >= 10) {
            setCustomerPhone(phone);
            setCustomerName(name || "");
            try {
              localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify({ phone, name: name || "" }));
            } catch {}
            setInitialized(true);
            return;
          }
        }
      }
    } catch {
      // Ignore
    }

    setInitialized(true);
  }, []);

  // Mounted ref + cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (closeModalTimeoutRef.current) clearTimeout(closeModalTimeoutRef.current);
    };
  }, []);

  // ── Define loadStats before the effect that calls it ──
  const loadStats = useCallback(async () => {
    if (!customerPhone) return;
    if (!mountedRef.current) return;
    setStatsLoading(true);
    try {
      const result = await fetchWithCache(`customer:stats:${customerPhone}`, () =>
        getCustomerStats(customerPhone)
      );
      if (mountedRef.current) setStats(result.data);
    } catch {
      // No data yet
    } finally {
      if (mountedRef.current) setStatsLoading(false);
    }
  }, [customerPhone]);

  // Keep loadStatsRef current for the realtime channel callback
  useEffect(() => {
    loadStatsRef.current = loadStats;
  }, [loadStats]);

  const loadNotifications = useCallback(async () => {
    if (!customerId) return;
    const [notifData, unread] = await Promise.all([
      getNotifs(customerId, "customer", 10),
      getUnreadCount(customerId, "customer"),
    ]);
    if (mountedRef.current) {
      setNotifications(notifData);
      setUnreadNotifCount(unread);
    }
  }, [customerId]);

  const loadCustomerId = useCallback(async (phone: string) => {
    const ids = await getCustomerIdsForPhone(phone);
    if (ids.length > 0 && mountedRef.current) {
      setCustomerId(ids[0]);
    }
  }, []);

  // Load stats + profile + notifications when phone is available
  useEffect(() => {
    if (onboardingCompletedRef.current) return;
    if (!initialized || !customerPhone) return;
    let cancelled = false;

    loadStats();
    loadCustomerId(customerPhone);

    setProfileLoading(true);
    getCustomerProfile(customerPhone).then((profile) => {
      if (cancelled || !profile || !mountedRef.current) return;
      const profileName = profile.name || "";
      if (profileName) {
        setCustomerName(profileName);
      }
      const nameIsMissing = !profileName || profileName.trim() === "" || profileName === "Customer";
      if (nameIsMissing) {
        setShowOnboarding(true);
      } else {
        // First-time users get the guided tour once their identity is resolved
        let tourSeen = true;
        try { tourSeen = localStorage.getItem(`tour_seen_customer_${customerPhone}`) === "1"; } catch { /* ignore */ }
        if (!tourSeen) setShowTour(true);
      }
      try {
        const raw = localStorage.getItem(CUSTOMER_STORAGE_KEY);
        const session = raw ? JSON.parse(raw) : {};
        if (profileName && profileName !== "Customer") {
          session.name = profileName;
        }
        localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(session));
      } catch {}
    }).catch(() => {}).finally(() => {
      if (mountedRef.current) setProfileLoading(false);
    });

    return () => { cancelled = true; };
  }, [initialized, customerPhone, loadStats, loadCustomerId]);

  // Load notifications when customerId resolves
  useEffect(() => {
    if (customerId) {
      loadNotifications();
    }
  }, [customerId, loadNotifications]);

  // If no customer phone after full init (both localStorage + cookie checked), redirect to login
  useEffect(() => {
    if (initialized && !customerPhone) {
      window.location.replace(`/${locale}/login`);
    }
  }, [initialized, customerPhone, locale]);

  // Supabase Realtime — listen for credit_log status changes
  const realtimeClientRef = useRef(createClient());
  const realtimeChannelRef = useRef<any>(null);
  const realtimeSetupStartedRef = useRef(false);

  useEffect(() => {
    if (!initialized || !customerPhone) return;
    if (realtimeSetupStartedRef.current) return;
    realtimeSetupStartedRef.current = true;

    const supabase = realtimeClientRef.current;

    const setupRealtime = async () => {
      if (!realtimeSetupStartedRef.current) return;

      const customerId = localStorage.getItem("merchant_id");
      if (!customerId) return;

      const customerIds = [customerId];

      realtimeChannelRef.current = supabase
        .channel("customer-dashboard-realtime")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "credit_logs",
            filter: `customer_id=in.(${customerIds.join(",")})`,
          },
          (payload: any) => {
            const oldStatus = payload.old?.status;
            const newStatus = payload.new?.status;
            if (oldStatus && newStatus && oldStatus !== newStatus) {
              if (newStatus === "approved") {
                playSuccessSound();
              }
              const verb =
                newStatus === "approved"
                  ? t("dashboard.approved")
                  : newStatus === "rejected"
                    ? t("dashboard.rejected")
                    : newStatus;
              addToast(
                `${verb} Rs. ${formatNumber(payload.new?.amount, locale as "en" | "ne")} ${t("dashboard.request")}`,
                newStatus === "approved" ? "success" : "warning"
              );
              setNotifications((prev) =>
                [{ id: payload.new?.id || crypto.randomUUID(), shopName: payload.new?.description || "Shop", amount: payload.new?.amount || 0, status: newStatus, created_at: new Date().toISOString() }, ...prev].slice(0, 10)
              );
              loadStatsRef.current();
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
            if (payload.new?.initiated_by === "customer") return;
            addToast(
              `📥 ${t("toast.newEntry")}: Rs. ${formatNumber(payload.new?.amount, locale as "en" | "ne")} — ${payload.new?.description || "Shop"}`,
              "info"
            );
            loadStatsRef.current();
          }
        )
        .subscribe();
    };

    setupRealtime();

    return () => {
      realtimeSetupStartedRef.current = false;
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [initialized, customerPhone, addToast, locale, t]);

  // Realtime for customer notifications table
  useEffect(() => {
    if (!customerId) return;
    const supabase = realtimeClientRef.current;
    const channel = supabase
      .channel("customer-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${customerId}`,
        },
        (payload: any) => {
          if (!mountedRef.current) return;
          if (payload.new?.type !== "entry_approved") playSuccessSound();
          loadNotifications();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [customerId, loadNotifications]);

  // Close customer notification dropdown on click outside
  useEffect(() => {
    if (!showNotifications) return;
    const handler = (e: PointerEvent) => {
      if (customerNotificationRef.current && !customerNotificationRef.current.contains(e.target as Node)) {
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

  // Close QR preview lightbox on Escape
  const qrPreviewRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!qrPreviewUrl) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setQrPreviewUrl(null);
        setQrPreviewLabel("");
      }
      if (e.key === "Tab" && qrPreviewRef.current) {
        const focusable = qrPreviewRef.current.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handler);
    qrPreviewRef.current?.querySelector<HTMLElement>("button")?.focus();
    return () => window.removeEventListener("keydown", handler);
  }, [qrPreviewUrl]);

  // Prevent background scrolling while QR preview is open
  useEffect(() => {
    if (!qrPreviewUrl) return;
    const scrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      document.documentElement.style.overflow = "";
      window.scrollTo(0, scrollY);
    };
  }, [qrPreviewUrl]);

  // Scan QR handler — moves modal to "enter" step
  const handleQRScan = useCallback(
    (data: string) => {
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === "merchant_scan") {
          setMerchantId(parsed.merchantId);
          setMerchantName(parsed.merchantName || "Shop");
          setSelectedProductId(null);
          setScanStep("enter");
        } else {
          addToast(t("scan.invalidQR"), "error");
        }
      } catch {
        addToast(t("scan.scanValidQR"), "error");
      }
    },
    [addToast, t]
  );

  const handleProductSelect = (product: { id: string; name: string; default_rate: number } | null) => {
    setSelectedProductId(product?.id ?? null);
    if (product) {
      setAmount(String(product.default_rate));
      setDescription(product.name);
    }
  };

  // Submit credit entry from modal (server-validated)
  const submitCreditEntry = async () => {
    if (!merchantId || !amount || Number(amount) <= 0) return;
    setSaving(true);
    try {
      if (isOnline()) {
        const result = await submitCustomerEntry({
          merchant_id: merchantId,
          phone: customerPhone,
          name: customerName || null,
          amount: Number(amount),
          description: description || null,
          type: entryType,
          idempotency_key: undefined,
        });
        if (!result.success) {
          addToast(result.error || t("errors.failedToSubmit"), "error");
          setSaving(false);
          return;
        }
      } else {
        await savePendingLog({
          id: crypto.randomUUID(),
          merchant_id: merchantId,
          customer_id: "",
          customerPhone: customerPhone,
          amount: Number(amount),
          description: description || null,
          type: entryType,
          status: "awaiting_confirmation",
          sync_status: "offline_pending",
          created_at: new Date().toISOString(),
        });
      }
      setScanStep("success");
      setShowPendingModal(true);
      loadStats();
      addToast(
        entryType === "credit"
          ? t("scan.creditSubmitted")
          : t("scan.paymentSubmitted"),
        "success"
      );
    } catch (err) {
      console.error("Failed to submit credit entry:", err);
      addToast(t("errors.failedToSubmit"), "error");
    } finally {
      setSaving(false);
    }
  };

  // Close the scan modal and reset state
  const closeModal = () => {
    setShowScanner(false);
    closeModalTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current) {
        setScanStep("scan");
        setMerchantId("");
        setMerchantName("");
        setAmount("");
        setDescription("");
        setSelectedProductId(null);
        setEntryType("debit");
      }
    }, 200);
  };

  const handleSignOut = () => {
    localStorage.removeItem(CUSTOMER_STORAGE_KEY);
    localStorage.removeItem("qr_hisab_auth_" + customerPhone);
    window.location.replace(`/${locale}`);
  };

  const handleOnboardingComplete = useCallback(() => {
    onboardingCompletedRef.current = true;
    setShowOnboarding(false);
    if (customerPhone) {
      let seen = true;
      try { seen = localStorage.getItem(`tour_seen_customer_${customerPhone}`) === "1"; } catch { /* ignore */ }
      if (!seen) setShowTour(true);
    }
  }, [customerPhone]);

  const handleTourFinish = useCallback(() => {
    setShowTour(false);
    if (customerPhone) {
      try { localStorage.setItem(`tour_seen_customer_${customerPhone}`, "1"); } catch { /* ignore */ }
    }
  }, [customerPhone]);

  // Replay the tour on demand (from the About sheet)
  useEffect(() => {
    const handler = () => setShowTour(true);
    window.addEventListener("tour:replay", handler);
    return () => window.removeEventListener("tour:replay", handler);
  }, []);

  // Prevent flash while reading localStorage
  if (!initialized) {
    return (
      <div className="min-h-dvh bg-[var(--color-bg)] flex items-center justify-center">
        <div role="status" className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <CustomerPinGate phone={customerPhone} onUnlocked={() => {}} onSignOut={handleSignOut}>
    {showOnboarding && customerPhone && (
      <CustomerOnboardingModal phone={customerPhone} onComplete={handleOnboardingComplete} />
    )}
    {showTour && (
      <OnboardingTour
        steps={CUSTOMER_TOUR_STEPS}
        open={showTour}
        onComplete={handleTourFinish}
        onSkip={handleTourFinish}
      />
    )}
    <div className="min-h-dvh bg-[var(--color-bg)] pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[var(--color-surface)]/80 backdrop-blur-md border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between px-3 py-2.5 min-h-[56px]">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <LogoWithAbout size={32} showAnimation={false} />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-[var(--color-text)] truncate max-w-[160px] sm:max-w-[240px] leading-tight">
                  {customerName || t("common.customer")}
                </span>
                <RoleSwitcher compact />
              </div>
              <p className="text-[10px] text-[var(--color-primary)] truncate leading-tight mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] inline-block" />
                QR Hisab &middot; {t("dashboard.activeStatus").split("·")[1]?.trim() || "Active"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <LocaleSwitcher />
            <div ref={customerNotificationRef}>
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                }}
                className="flex items-center justify-center w-[44px] h-[44px] active:scale-90 transition-transform relative"
                aria-label={t("notifications.title")}
              >
                <svg className="w-5 h-5 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
                {unreadNotifCount > 0 && (
                  <span className="absolute top-0 right-0 min-w-[18px] h-[18px] flex items-center justify-center bg-blue-500 text-white text-[10px] font-bold rounded-full border-2 border-white px-1">
                    {unreadNotifCount}
                  </span>
                )}
                {(stats?.pendingCount ?? 0) > 0 && (
                  <span className="absolute top-0 left-0 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white px-1 animate-pulse-soft">
                    {stats?.pendingCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Customer notification dropdown (outside sticky header) */}
      {showNotifications && (
        <div
          className="fixed right-4 top-16 w-72 bg-[var(--color-surface)] rounded-2xl shadow-xl border border-[var(--color-border)] overflow-hidden z-[100] animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-3 border-b border-[var(--color-border)] flex items-center justify-between">
            <p className="text-sm font-semibold text-[var(--color-text)]">{t("notifications.title")}</p>
            {notifications.length > 0 && (
              <span className="text-[10px] text-[var(--color-text-muted)]">{notifications.length}</span>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
                {t("notifications.noNotifications")}
              </div>
            ) : (
              notifications.slice(0, 10).map((n: any) => (
                <a
                  key={n.id}
                  href={`/${locale}/customer/history`}
                  onClick={() => {
                    if (customerId) {
                      markAsRead(customerId, "customer").then(() => {
                        setUnreadNotifCount(0);
                        loadNotifications();
                      }).catch(() => {});
                    }
                  }}
                  className={`flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 active:bg-gray-100 dark:active:bg-gray-800 transition-colors ${!n.read ? "bg-blue-50/30" : ""}`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    n.type === "entry_approved" ? "bg-green-50 dark:bg-green-900/20" :
                    n.type === "entry_rejected" || n.type === "edit_rejected" ? "bg-red-50 dark:bg-red-900/20" :
                    n.type === "entry_created" ? "bg-amber-50 dark:bg-amber-900/20" :
                    n.type === "credit_limit_changed" ? "bg-blue-50 dark:bg-blue-900/20" :
                    "bg-gray-50 dark:bg-gray-800/50"
                  }`}>
                    <span className={`text-xs font-bold ${
                      n.type === "entry_approved" ? "text-green-600 dark:text-green-400" :
                      n.type === "entry_rejected" || n.type === "edit_rejected" ? "text-red-600 dark:text-red-400" :
                      n.type === "entry_created" ? "text-amber-600 dark:text-amber-400" :
                      n.type === "edit_accepted" ? "text-green-600 dark:text-green-400" :
                      n.type === "credit_limit_changed" ? "text-blue-600 dark:text-blue-400" :
                      "text-[var(--color-text-muted)]"
                    }`}>
                      {n.type === "entry_approved" ? "✓" :
                       n.type === "entry_rejected" || n.type === "edit_rejected" ? "✗" :
                       n.type === "entry_created" ? "+" :
                       n.type === "edit_accepted" ? "✓" :
                       n.type === "credit_limit_changed" ? "💰" :
                       "•"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[var(--color-text)] truncate">{n.title}</p>
                    {n.body && <p className="text-[10px] text-[var(--color-text-muted)] truncate">{n.body}</p>}
                    <p className="text-[9px] text-[var(--color-text-muted)] mt-0.5">
                      {new Date(n.created_at).toLocaleDateString(locale === "ne" ? "ne-NP" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </a>
              ))
            )}
          </div>
          <a
            href={`/${locale}/customer/history`}
            className="block text-center text-xs font-medium text-[var(--color-primary)] py-3 border-t border-[var(--color-border)] hover:bg-gray-50 dark:hover:bg-gray-800/50 active:bg-gray-100 dark:active:bg-gray-800 transition-colors"
          >
            {t("notifications.viewAll")}
          </a>
        </div>
      )}

      {/* ===== ALWAYS-VISIBLE DASHBOARD CONTENT ===== */}
      <PullToRefresh onRefresh={async () => {
        if (!customerPhone || !mountedRef.current) return;
        try {
          const data = await getCustomerStats(customerPhone);
          if (mountedRef.current) setStats(data);
        } catch {}
      }}>
      <div className="px-4 py-4 space-y-4">
        {/* Customer identity badge */}
        <div className="bg-[var(--color-surface)] rounded-2xl p-4 shadow-sm border border-[var(--color-border)] flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-[var(--color-text)] truncate flex items-center gap-1.5">
              {customerName || maskPhone(customerPhone)}
              {profileLoading && (
                <div className="w-3 h-3 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin flex-shrink-0" />
              )}
            </p>
            {customerName && (
              <p className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
                <span>{showFullPhone ? customerPhone : maskPhone(customerPhone)}</span>
                <button
                  onClick={() => setShowFullPhone(!showFullPhone)}
                  className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title={showFullPhone ? "Hide number" : "Show full number"}
                >
                  {showFullPhone ? (
                    <svg className="w-3.5 h-3.5 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </p>
            )}
          </div>
          <button
            onClick={() => { setEditName(customerName); setEditPhone(customerPhone); setShowEditProfile(true); }}
            className="text-xs text-[var(--color-primary)] font-medium px-3 py-1.5 rounded-lg bg-[var(--color-primary)]/5 active:scale-95 transition-transform"
          >
            {t("common.edit")}
          </button>
        </div>

        {/* Pending Transaction Notification Banner — PROMINENT */}
        {!statsLoading && stats && stats.pendingCount > 0 && (
          <a
            href={`/${locale}/customer/history`}
            className="relative flex items-center gap-3 px-4 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl shadow-lg shadow-amber-500/25 active:scale-[0.98] transition-transform overflow-hidden"
          >
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIvPjwvc3ZnPg==')] opacity-50" />
            <div className="relative w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 animate-bounce-subtle">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
            </div>
            <div className="relative flex-1">
              <p className="text-sm font-bold">
                {t("dashboard.pendingTransactions", { count: stats.pendingCount })}
              </p>
              <p className="text-xs text-white/80 mt-0.5">{t("dashboard.tapToReview")}</p>
            </div>
            <svg className="relative w-5 h-5 text-white/80 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </a>
        )}

        {/* Outstanding Balance Card */}
        {statsLoading ? (
          <div className="bg-[var(--color-surface)] rounded-2xl p-5 shadow-sm border border-[var(--color-border)] flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : stats ? (
          <>
          <button
            onClick={() => setShowShops(!showShops)}
            data-tour="balance"
            className="w-full text-left bg-gradient-to-br from-[var(--color-primary-surface)] to-[var(--color-primary-surface-dark)] rounded-2xl p-5 shadow-sm text-white active:opacity-90 transition-opacity"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-80 mb-1">{t("dashboard.outstandingBalance")}</p>
                <p className="text-3xl font-bold mb-1">
                  {t("currency.prefix")}{formatNumber(stats.totalOutstanding, locale as "en" | "ne")}
                </p>
                <p className="text-xs opacity-60">
                  {t("dashboard.acrossShops", { count: stats.shopsCount })}
                  {stats.totalCreditLimit > 0 && (
                    <> &middot; {t("dashboard.creditLimit")} {t("currency.prefix")}{formatNumber(stats.totalCreditLimit, locale as "en" | "ne")}</>
                  )}
                </p>
              </div>
              {stats.relationships.filter(r => r.merchants?.id).length > 0 && (
                <svg
                  className={`w-5 h-5 opacity-60 transition-transform duration-200 ${showShops ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              )}
            </div>
          </button>

          {showShops && stats.relationships.filter(r => r.merchants?.id).length > 0 && (
            <div className="space-y-2 animate-fade-in">
              <p className="text-sm font-semibold text-[var(--color-text)] px-1">{t("dashboard.yourShops")}</p>
              {stats.relationships.filter(r => r.merchants?.id).map((rel, i) => (
                <div
                  key={i}
                  className="bg-[var(--color-surface)] rounded-2xl p-4 shadow-sm border border-[var(--color-border)]"
                >
                  <div className="flex items-center justify-between mb-2">
                    <a
                      href={`/${locale}/customer/history?merchantId=${rel.merchants!.id}&shopName=${encodeURIComponent(rel.merchants!.name || "Shop")}`}
                      className="font-semibold text-[var(--color-text)] truncate"
                    >
                      {rel.merchants!.name || t("dashboard.shopName")}
                    </a>
                    <span className="text-lg font-bold text-[var(--color-text)] flex-shrink-0 ml-2">
                      {t("currency.prefix")}{formatNumber(rel.current_balance, locale as "en" | "ne")}
                    </span>
                  </div>
                  {rel.current_balance > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setPaymentMethodsMerchant({ id: rel.merchants!.id, name: rel.merchants!.name || "Shop" });
                          setShowPaymentMethods(true);
                          setPaymentMethodsLoading(true);
                          getMerchantPaymentMethodsPublic(rel.merchants!.id).then((methods) => {
                            setPaymentMethods(methods);
                            setPaymentMethodsLoading(false);
                          }).catch(() => {
                            setPaymentMethods([]);
                            setPaymentMethodsLoading(false);
                          });
                        }}
                        className="flex-1 py-2 bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] rounded-xl text-sm font-medium active:scale-[0.98] transition-transform"
                      >
                        {t("dashboard.payNow")}
                      </button>
                      <button
                        onClick={() => {
                          setVoucherMerchant({ id: rel.merchants!.id, name: rel.merchants!.name || "Shop" });
                          setVoucherAmount(rel.current_balance > 0 ? String(rel.current_balance) : "");
                          setVoucherFile(null);
                          setVoucherPreview(null);
                          setShowVoucherModal(true);
                        }}
                        className="flex-1 py-2 bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-xl text-sm font-medium active:scale-[0.98] transition-transform"
                      >
                        {t("dashboard.uploadVoucher")}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          </>
        ) : (
          <div className="bg-[var(--color-surface)] rounded-2xl p-8 shadow-sm border border-[var(--color-border)] text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--color-primary)]/5 flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
              </svg>
            </div>
            <p className="font-semibold text-[var(--color-text)]">{t("dashboard.noOutstanding")}</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              {t("dashboard.firstCreditHint")}
            </p>
            <div className="mt-4 text-left bg-[var(--color-primary)]/5 rounded-xl p-3 space-y-2">
              <p className="text-[11px] font-semibold text-[var(--color-primary-dark)] uppercase tracking-wider">{t("dashboard.howItWorks")}</p>
              <p className="text-xs text-[var(--color-text-muted)]"><span className="font-bold text-[var(--color-text)]">1.</span> {t("dashboard.step1")}</p>
              <p className="text-xs text-[var(--color-text-muted)]"><span className="font-bold text-[var(--color-text)]">2.</span> {t("dashboard.step2")}</p>
            </div>
            <button
              onClick={() => { setShowScanner(true); setScanStep("scan"); }}
              className="mt-4 px-6 py-2.5 bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] rounded-xl text-sm font-medium active:scale-[0.98] transition-transform inline-flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM6.75 6.75h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
              </svg>
              {t("dashboard.scanShopQR")}
            </button>
          </div>
        )}

        {/* Scan Shop QR — always visible primary CTA */}
        <button
          onClick={() => { setShowScanner(true); setScanStep("scan"); }}
          data-tour="scan"
          className="w-full flex items-center gap-4 p-5 bg-[var(--color-surface)] rounded-2xl shadow-sm border border-[var(--color-border)] active:scale-[0.98] transition-transform text-left"
        >
          <div className="w-12 h-12 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-[var(--color-text)]">{t("dashboard.scanShopQR")}</p>
            <p className="text-xs text-[var(--color-text-muted)]">{t("dashboard.scanShopQRDesc")}</p>
          </div>
          <svg className="w-5 h-5 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>

        {/* Quick Action: Transaction History */}
        <a
          href={`/${locale}/customer/history`}
          data-tour="history"
          className="flex items-center gap-4 p-5 bg-[var(--color-surface)] rounded-2xl shadow-sm border border-[var(--color-border)] active:scale-[0.98] transition-transform"
        >
          <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-[var(--color-text)]">{t("dashboard.transactionHistory")}</p>
            <p className="text-xs text-[var(--color-text-muted)]">{t("dashboard.viewAllTransactions")}</p>
          </div>
          <svg className="w-5 h-5 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </a>
      </div>
      </PullToRefresh>

      <CustomerBottomNav locale={locale} />

      {/* ===== SCAN MODAL OVERLAY ===== */}
      {showScanner && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="w-full max-w-md bg-[var(--color-surface)] rounded-t-3xl sm:rounded-3xl p-6 animate-slide-up max-h-[90dvh] overflow-y-auto">
            {/* Modal handle */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg text-[var(--color-text)]">
                {scanStep === "scan" ? t("scan.title")
                  : scanStep === "enter" ? t("scan.enterAmount")
                  : t("scan.success")}
              </h2>
              <button
                onClick={closeModal}
                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center active:scale-90 transition-transform"
              >
                <svg className="w-4 h-4 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Step 1: Scan QR */}
            {scanStep === "scan" && (
              <div className="space-y-4">
                <p className="text-center text-sm text-[var(--color-text-muted)]">
                  {t("scan.pointCamera")}
                </p>
                <QRScanner onScan={handleQRScan} onClose={closeModal} />
              </div>
            )}

            {/* Step 2: Enter Amount */}
            {scanStep === "enter" && (
              <div className="space-y-4">
                <div className="bg-[var(--color-surface)] rounded-2xl p-4 shadow-sm border border-[var(--color-border)] text-center">
                  <p className="text-xs text-[var(--color-text-muted)] mb-1">{t("scan.merchantName")}</p>
                  <p className="font-bold text-lg text-[var(--color-text)]">{merchantName}</p>
                </div>

                {/* Debit / Credit toggle */}
                <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
                  <button
                    onClick={() => setEntryType("debit")}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      entryType === "debit"
                        ? "bg-[var(--color-surface)] text-[var(--color-danger)] shadow-sm"
                        : "text-[var(--color-text-muted)]"
                    }`}
                  >
                    {t("scan.creditTaken")}
                  </button>
                  <button
                    onClick={() => setEntryType("credit")}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      entryType === "credit"
                        ? "bg-[var(--color-surface)] text-[var(--color-primary)] shadow-sm"
                        : "text-[var(--color-text-muted)]"
                    }`}
                  >
                    {t("scan.payment")}
                  </button>
                </div>

                <CustomerProductPicker
                  merchantId={merchantId}
                  selectedProductId={selectedProductId}
                  onSelect={handleProductSelect}
                />

                <div>
                  <label className="text-sm font-medium text-[var(--color-text)]">{t("scan.amount")}</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full mt-1 px-4 py-4 bg-[var(--color-surface)] rounded-2xl text-2xl sm:text-3xl font-bold text-center border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
                    autoFocus
                  />
                  <AmountSuggestions onSelect={(v) => setAmount(String(v))} />
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--color-text)]">{t("scan.description")}</label>
                  <input
                    type="text"
                    placeholder={t("scan.descriptionPlaceholder")}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full mt-1 px-4 py-3 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setScanStep("scan")}
                    className="flex-1 py-3.5 bg-gray-100 dark:bg-gray-800 text-[var(--color-text)] rounded-xl font-medium active:scale-[0.98] transition-transform"
                  >
                    {t("scan.backToScan")}
                  </button>
                  <button
                    onClick={submitCreditEntry}
                    disabled={!amount || Number(amount) <= 0 || saving}
                    className="flex-1 py-3.5 bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      t("scan.sendRequest")
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Success */}
            {scanStep === "success" && (
              <div className="space-y-4 text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-[var(--color-text)]">{t("scan.success")}</h3>
                <p className="text-sm text-[var(--color-text-muted)]">
                  {entryType === "credit" ? t("scan.creditSubmitted") : t("scan.paymentSubmitted")}
                </p>
                <button
                  onClick={closeModal}
                  className="w-full py-3.5 bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] rounded-xl font-semibold active:scale-[0.98] transition-transform"
                >
                  {t("common.done")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== EDIT PROFILE MODAL ===== */}
      {showEditProfile && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowEditProfile(false); }}
        >
          <div className="w-full max-w-md bg-[var(--color-surface)] rounded-3xl p-6 animate-slide-up">
            <h2 className="text-lg font-bold text-[var(--color-text)] mb-4">{t("settings.profile")}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{t("settings.name")}</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-3 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">{t("settings.phone")}</label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-4 py-3 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEditProfile(false)}
                className="flex-1 py-3 rounded-xl font-medium text-[var(--color-text)] bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={async () => {
                  // TODO: Implement profile update
                  setShowEditProfile(false);
                  addToast(t("toast.profileSaved"), "success");
                }}
                className="flex-1 py-3 rounded-xl font-semibold text-white bg-[var(--color-primary-surface)] hover:bg-[var(--color-primary-surface-hover)] transition flex items-center justify-center gap-2"
              >
                {t("common.save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== VOUCHER UPLOAD MODAL ===== */}
      {showVoucherModal && voucherMerchant && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowVoucherModal(false); }}
        >
          <div className="w-full max-w-md bg-[var(--color-surface)] rounded-3xl p-6 animate-slide-up max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg text-[var(--color-text)]">{t("modals.voucherUpload.title")}</h2>
              <button
                onClick={() => setShowVoucherModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center active:scale-90 transition-transform"
              >
                <svg className="w-4 h-4 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div className="bg-[var(--color-surface)] rounded-2xl p-4 shadow-sm border border-[var(--color-border)] text-center">
                <p className="text-xs text-[var(--color-text-muted)] mb-1">{t("modals.voucherUpload.shop")}</p>
                <p className="font-bold text-lg text-[var(--color-text)]">{voucherMerchant.name}</p>
                <p className="text-xs text-[var(--color-primary)] mt-1">{t("modals.voucherUpload.amount")}: {t("currency.prefix")}{formatNumber(Number(voucherAmount), locale as "en" | "ne")}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-2">{t("modals.voucherUpload.selectFile")}</label>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setVoucherFile(file);
                      const blob = await resizeImage(file, 1200);
                      setVoucherPreview(URL.createObjectURL(blob));
                    }
                  }}
                  className="w-full px-4 py-3 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
                />
              </div>
              {voucherPreview && (
                <div className="relative">
                  <img src={voucherPreview} alt={t("modals.voucherUpload.preview")} className="w-full max-h-64 object-contain rounded-xl" />
                  <button
                    onClick={() => { setVoucherPreview(null); setVoucherFile(null); }}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowVoucherModal(false)}
                  className="flex-1 py-3.5 bg-gray-100 dark:bg-gray-800 text-[var(--color-text)] rounded-xl font-medium active:scale-[0.98] transition-transform"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={async () => {
                    if (!voucherFile) return;
                    setVoucherUploading(true);
                    try {
                      // TODO: Get customerId from customerPhone
                      const customerIds = await getCustomerIdsForPhone(customerPhone);
                      const customerId = customerIds[0];
                      if (!customerId) throw new Error("Customer not found");
                      
                      await submitPaymentVoucher(
                        voucherMerchant.id,
                        customerId,
                        Number(voucherAmount),
                        voucherFile
                      );
                      addToast(t("toast.entrySubmitted"), "success");
                      setShowVoucherModal(false);
                    } catch {
                      addToast(t("errors.failedToSubmit"), "error");
                    } finally {
                      setVoucherUploading(false);
                    }
                  }}
                  disabled={!voucherFile || voucherUploading}
                  className="flex-1 py-3.5 bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {voucherUploading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {t("modals.voucherUpload.uploading")}
                    </>
                  ) : (
                    t("modals.voucherUpload.upload")
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== PAYMENT METHODS MODAL ===== */}
      {showPaymentMethods && paymentMethodsMerchant && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowPaymentMethods(false); }}
        >
          <div className="w-full max-w-md bg-[var(--color-surface)] rounded-3xl p-6 animate-slide-up max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg text-[var(--color-text)]">{t("modals.paymentMethods.title")} - {paymentMethodsMerchant.name}</h2>
              <button
                onClick={() => setShowPaymentMethods(false)}
                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center active:scale-90 transition-transform"
              >
                <svg className="w-4 h-4 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              {paymentMethodsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : paymentMethods.length === 0 ? (
                <div className="text-center py-8 text-[var(--color-text-muted)]">
                  {t("modals.paymentMethods.noMethods")}
                </div>
              ) : (
                paymentMethods.map((method, i) => (
                  <div key={i} className="bg-[var(--color-surface)] rounded-2xl p-4 shadow-sm border border-[var(--color-border)]">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center">
                        {method.method_type === "qr" && (
                          <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                          </svg>
                        )}
                        {method.method_type === "bank" && (
                          <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
                          </svg>
                        )}
                        {method.method_type === "cash" && (
                          <svg className="w-5 h-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0zM12 6.753v.243M21 12c0 4.556-3.663 8.25-8.19 8.25S4.81 16.556 4.81 12" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-[var(--color-text)]">
                          {method.method_type === "qr" ? t("modals.paymentMethods.qrCode") :
                           method.method_type === "bank" ? t("modals.paymentMethods.bankTransfer") :
                           t("modals.paymentMethods.cash")}
                        </p>
                        {method.label && <p className="text-xs text-[var(--color-text-muted)]">{method.label}</p>}
                      </div>
                    </div>
                    {method.method_type === "bank" && (
                      <div className="space-y-2 text-sm text-[var(--color-text-muted)]">
                        {method.account_holder && (
                          <p><span className="font-medium text-[var(--color-text)]">{t("modals.paymentMethods.accountHolder")}:</span> {method.account_holder}</p>
                        )}
                        {method.account_number && (
                          <p><span className="font-medium text-[var(--color-text)]">{t("modals.paymentMethods.accountNumber")}:</span> {method.account_number}</p>
                        )}
                        {method.bank_name && (
                          <p><span className="font-medium text-[var(--color-text)]">{t("modals.paymentMethods.bankName")}:</span> {method.bank_name}</p>
                        )}
                      </div>
                    )}
                    {method.method_type === "qr" && method.qr_url && (
                      <div className="mt-3">
                        <img src={method.qr_url} alt="QR Code" className="w-32 h-32 mx-auto rounded-xl" />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== PENDING APPROVAL MODAL ===== */}
      {showPendingModal && (
        <PendingApprovalModal
          show={true}
          onClose={() => setShowPendingModal(false)}
          mode="customer"
          amount={amount ? Number(amount) : undefined}
          shopName={merchantName}
        />
      )}
    </div>
    </CustomerPinGate>
  );
}