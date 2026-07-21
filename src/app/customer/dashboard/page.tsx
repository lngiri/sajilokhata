"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import SyncStatus from "@/components/SyncStatus";
import PullToRefresh from "@/components/PullToRefresh";
import { QRScanner } from "@/components/QRCode";
import { useToast } from "@/components/Toast";
import { playSuccessSound } from "@/lib/sound";
import AmountSuggestions from "@/components/AmountSuggestions";
import PendingApprovalModal from "@/components/PendingApprovalModal";
import CustomerBottomNav from "@/components/CustomerBottomNav";
import RoleSwitcher from "@/components/RoleSwitcher";
import OtherRolePrompt from "@/components/OtherRolePrompt";
import CustomerPinGate from "@/components/CustomerPinGate";
import { createClient } from "@/lib/supabase/client";
import { normalizePhone } from "@/lib/phone";
import { isOnline, savePendingLog } from "@/lib/offline/db";
import {
  findOrCreateCustomer,
  getCustomerStats,
} from "@/app/actions/customer";
import { getMerchantPaymentMethodsPublic, submitPaymentVoucher } from "@/app/actions/merchant";
import { getCustomerProfile, updateCustomerAvatar, submitCustomerEntry } from "@/app/actions/customer";
import CustomerOnboardingModal from "@/components/CustomerOnboardingModal";

function maskPhone(phone: string): string {
  if (phone.length < 8) return phone;
  return phone.slice(0, 4) + "****" + phone.slice(-2);
}

/** Key used to persist customer session in localStorage */
const CUSTOMER_STORAGE_KEY = "sajilo_customer_session";

export default function CustomerDashboard() {
  const { addToast } = useToast();

  // Customer identity
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Stats
  const [stats, setStats] = useState<{
    totalOutstanding: number;
    shopsCount: number;
    totalCreditLimit: number;
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
  const [saving, setSaving] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);

  // Customer avatar
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

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
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    shopName: string;
    amount: number;
    status: string;
    created_at: string;
  }>>([]);
  const customerNotificationRef = useRef<HTMLDivElement>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
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
          setAvatarUrl(session.avatar_url || null);
          setInitialized(true);
          return;
        }
      }
    } catch {
      // Corrupted localStorage — fall through to cookie
    }

    // Fallback: try to read session from cookie
    try {
      const match = document.cookie
        .split("; ")
        .find((c) => c.startsWith("customer_session="));
      if (match) {
        const val = decodeURIComponent(match.split("=").slice(1).join("="));
        const session = JSON.parse(val);
        if (session.phone) {
          setCustomerPhone(session.phone);
          setCustomerName(session.name || "");
          // Persist back to localStorage so future reads work
          try {
            localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify({ phone: session.phone, name: session.name || "" }));
          } catch {}
          setInitialized(true);
          return;
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
      const data = await getCustomerStats(customerPhone);
      if (mountedRef.current) setStats(data);
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

  // Load stats + profile when phone is available
  useEffect(() => {
    if (onboardingCompletedRef.current) return;
    if (!initialized || !customerPhone) return;
    let cancelled = false;

    loadStats();

    setProfileLoading(true);
    getCustomerProfile(customerPhone).then((profile) => {
      if (cancelled || !profile || !mountedRef.current) return;
      setAvatarUrl(profile.avatar_url);
      const profileName = profile.name || "";
      if (profileName) {
        setCustomerName(profileName);
      }
      const nameIsMissing = !profileName || profileName.trim() === "" || profileName === "Customer";
      if (nameIsMissing) {
        setShowOnboarding(true);
      }
      try {
        const raw = localStorage.getItem(CUSTOMER_STORAGE_KEY);
        const session = raw ? JSON.parse(raw) : {};
        session.avatar_url = profile.avatar_url || undefined;
        if (profileName && profileName !== "Customer") {
          session.name = profileName;
        }
        localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(session));
      } catch {}
    }).catch(() => {}).finally(() => {
      if (mountedRef.current) setProfileLoading(false);
    });

    return () => { cancelled = true; };
  }, [initialized, customerPhone, loadStats]);

  // If no customer phone after full init (both localStorage + cookie checked), redirect to login
  useEffect(() => {
    if (initialized && !customerPhone) {
      // Send them to login instead of /scan — the login flow will set up the session properly
      window.location.replace("/login");
    }
  }, [initialized, customerPhone]);

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

      // Use the customer ID directly from localStorage (set during login)
      // This avoids an RLS-blocked client-side query on the customers table.
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
                  ? "Approved!"
                  : newStatus === "rejected"
                    ? "Rejected"
                    : newStatus;
              addToast(
                `${verb} Rs. ${Number(payload.new?.amount || 0).toLocaleString()} request`,
                newStatus === "approved" ? "success" : "warning"
              );
              setNotifications((prev) =>
                [{ id: payload.new?.id || crypto.randomUUID(), shopName: payload.new?.description || "Shop", amount: payload.new?.amount || 0, status: newStatus, created_at: new Date().toISOString() }, ...prev].slice(0, 10)
              );
              loadStatsRef.current();
            }
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
  }, [initialized, customerPhone, addToast]);

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
      // Focus trap: Tab cycles inside the dialog
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
    // Auto-focus the close button on open
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

  // Scan QR handler — moves modal to "enter" step
  const handleQRScan = useCallback(
    (data: string) => {
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === "merchant_scan") {
          setMerchantId(parsed.merchantId);
          setMerchantName(parsed.merchantName || "Shop");
          setScanStep("enter");
        } else {
          addToast("Please scan a valid shop QR code.", "error");
        }
      } catch {
        addToast("Invalid QR code. Please scan a valid shop QR.", "error");
      }
    },
    [addToast]
  );

  // Submit credit entry from modal (server-validated)
  const submitCreditEntry = async () => {
    if (!merchantId || !amount || Number(amount) <= 0) return;
    setSaving(true);
    try {
      if (isOnline()) {
        const result = await submitCustomerEntry(
          merchantId,
          Number(amount),
          entryType,
          description || null,
        );
        if (!result.success) {
          addToast(result.error || "Failed to submit entry", "error");
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
          status: "pending",
          sync_status: "offline_pending",
          created_at: new Date().toISOString(),
        });
      }
      setScanStep("success");
      setShowPendingModal(true);
      loadStats();
      addToast(
        entryType === "credit"
          ? "Payment submitted! Awaiting merchant confirmation."
          : "Credit request sent! Awaiting merchant approval.",
        "success"
      );
    } catch (err) {
      console.error("Failed to submit credit entry:", err);
      addToast("Failed to submit. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  // Close the scan modal and reset state
  const closeModal = () => {
    setShowScanner(false);
    // Delay reset so the modal animation plays out
    closeModalTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current) {
        setScanStep("scan");
        setMerchantId("");
        setMerchantName("");
        setAmount("");
        setDescription("");
        setEntryType("debit");
      }
    }, 200);
  };

  const handleSignOut = () => {
    localStorage.removeItem(CUSTOMER_STORAGE_KEY);
    localStorage.removeItem("qr_hisab_auth_" + customerPhone);
    window.location.replace("/");
  };

  const handleOnboardingComplete = useCallback(() => {
    onboardingCompletedRef.current = true;
    setShowOnboarding(false);
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
    <div className="min-h-dvh bg-[var(--color-bg)] pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm flex-shrink-0">
              <span className="text-sm font-bold text-white tracking-tight">QR</span>
            </div>
            <div>
              <h1 className="text-base font-bold text-[var(--color-text)]">QR Hisab Customer</h1>
              <p className="text-[10px] text-emerald-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                QR Hisab &middot; Active
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SyncStatus />
            <RoleSwitcher />
            <div ref={customerNotificationRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-1.5 active:scale-90 transition-transform relative"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
                {notifications.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
                )}
              </button>
            </div>
            {customerPhone && (
              <button
                onClick={() => setShowProfileMenu(true)}
                className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold shadow-sm active:scale-90 transition-transform overflow-hidden"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  (customerName || customerPhone).charAt(0).toUpperCase()
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Customer notification dropdown (outside sticky header) */}
      {showNotifications && (
        <div
          className="fixed right-4 top-16 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-[100] animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-[var(--color-text)]">Notifications</p>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {notifications.length > 0 ? (
              notifications.slice(0, 3).map((n) => (
                <a
                  key={n.id}
                  href="/customer/history"
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    n.status === "approved" ? "bg-green-50" : n.status === "rejected" ? "bg-red-50" : "bg-amber-50"
                  }`}>
                    <span className={`text-xs font-bold ${
                      n.status === "approved" ? "text-green-600" : n.status === "rejected" ? "text-red-600" : "text-amber-600"
                    }`}>
                      {n.status === "approved" ? "✓" : n.status === "rejected" ? "✗" : "!"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[var(--color-text)] truncate">
                      {n.shopName} — Rs. {n.amount.toLocaleString()} {n.status}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-muted)]">
                      {new Date(n.created_at).toLocaleTimeString()}
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
            href="/customer/history"
            className="block text-center text-xs font-medium text-[var(--color-primary)] py-3 border-t border-gray-100 hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            View All
          </a>
        </div>
      )}

      {/* Profile menu modal */}
      {showProfileMenu && (
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
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  (customerName || customerPhone).charAt(0).toUpperCase()
                )}
              </div>
              <p className="text-base font-bold text-[var(--color-text)] text-center truncate max-w-full">
                {customerName || "Customer"}
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5 font-mono">
                {customerPhone || ""}
              </p>
            </div>

            {/* Actions */}
            <div className="p-4 space-y-2">
              <a
                href="/customer/settings"
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-[var(--color-text)] hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a17.933 17.933 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
                Edit Profile
              </a>

              <button
                onClick={async () => {
                  setShowProfileMenu(false);
                  localStorage.removeItem(CUSTOMER_STORAGE_KEY);
                  localStorage.removeItem("qr_hisab_auth_" + customerPhone);
                  window.location.replace("/");
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
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50 flex items-center gap-3">
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
                  className="p-0.5 rounded hover:bg-gray-100 transition-colors"
                  title={showFullPhone ? "Hide number" : "Show full number"}
                >
                  {showFullPhone ? (
                    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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
            Edit
          </button>
        </div>

        {/* Outstanding Balance Card */}
        {statsLoading ? (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-50 flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : stats ? (
          <a
            href="/customer/history"
            className="block bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] rounded-2xl p-5 shadow-sm text-white active:opacity-90 transition-opacity"
          >
            <p className="text-sm opacity-80 mb-1">Total Outstanding Balance</p>
            <p className="text-3xl font-bold mb-1">
              Rs. {stats.totalOutstanding.toLocaleString()}
            </p>
            <p className="text-xs opacity-60">
              Across {stats.shopsCount} shop{stats.shopsCount !== 1 ? "s" : ""}
              {stats.totalCreditLimit > 0 && (
                <> &middot; Limit Rs. {stats.totalCreditLimit.toLocaleString()}</>
              )}
            </p>

            {stats.relationships.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/20 space-y-2">
                {stats.relationships.filter(r => r.merchants?.id).map((rel, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-sm py-1.5 -mx-1 px-2 rounded-lg"
                  >
                    <a
                      href={`/customer/history?merchantId=${rel.merchants!.id}&shopName=${encodeURIComponent(rel.merchants!.name || "Shop")}`}
                      className="flex-1 min-w-0 opacity-80 hover:opacity-100 transition-opacity truncate"
                    >
                      {rel.merchants!.name || "Unknown Shop"}
                    </a>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="font-semibold">Rs. {rel.current_balance.toLocaleString()}</span>
                      {rel.current_balance > 0 && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
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
                            className="px-2.5 py-1 bg-white/20 text-white rounded-lg text-[10px] font-medium active:bg-white/30 transition-colors"
                          >
                            Pay Now
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setVoucherMerchant({ id: rel.merchants!.id, name: rel.merchants!.name || "Shop" });
                              setVoucherAmount("");
                              setVoucherFile(null);
                              setVoucherPreview(null);
                              setShowVoucherModal(true);
                            }}
                            className="px-2.5 py-1 bg-purple-500/20 text-purple-200 rounded-lg text-[10px] font-medium active:bg-purple-500/30 transition-colors"
                          >
                            Upload Voucher
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </a>
        ) : (
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-50 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--color-primary)]/5 flex items-center justify-center">
              <svg className="w-8 h-8 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
              </svg>
            </div>
            <p className="font-semibold text-[var(--color-text)]">No outstanding credit yet</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              Submit your first credit request by scanning a shop QR
            </p>
            <button
              onClick={() => { setShowScanner(true); setScanStep("scan"); }}
              className="mt-4 px-6 py-2.5 bg-[var(--color-primary)] text-white rounded-xl text-sm font-medium active:scale-[0.98] transition-transform inline-flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM6.75 6.75h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
              </svg>
              Scan Shop QR
            </button>
          </div>
        )}

        {/* Scan Shop QR — always visible primary CTA */}
        <button
          onClick={() => { setShowScanner(true); setScanStep("scan"); }}
          className="w-full flex items-center gap-4 p-5 bg-white rounded-2xl shadow-sm border border-gray-50 active:scale-[0.98] transition-transform text-left"
        >
          <div className="w-12 h-12 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-[var(--color-text)]">Scan Shop QR</p>
            <p className="text-xs text-[var(--color-text-muted)]">Send credit or payment request to a shop</p>
          </div>
          <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>

        {/* Quick Action: Transaction History */}
        <a
          href="/customer/history"
          className="flex items-center gap-4 p-5 bg-white rounded-2xl shadow-sm border border-gray-50 active:scale-[0.98] transition-transform"
        >
          <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center">
            <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-[var(--color-text)]">Transaction History</p>
            <p className="text-xs text-[var(--color-text-muted)]">View all your credit requests and their status</p>
          </div>
          <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </a>
      </div>
      </PullToRefresh>

      {/* ===== SCAN MODAL OVERLAY ===== */}
      {showScanner && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 animate-slide-up max-h-[90dvh] overflow-y-auto">
            {/* Modal handle */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg text-[var(--color-text)]">
                {scanStep === "scan" ? "Scan Shop QR"
                  : scanStep === "enter" ? "Enter Amount"
                  : "Success!"}
              </h2>
              <button
                onClick={closeModal}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center active:scale-90 transition-transform"
              >
                <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Step 1: Scan QR */}
            {scanStep === "scan" && (
              <div className="space-y-4">
                <p className="text-center text-sm text-[var(--color-text-muted)]">
                  Point your camera at the shop&apos;s QR code
                </p>
                <QRScanner onScan={handleQRScan} />
              </div>
            )}

            {/* Step 2: Enter Amount */}
            {scanStep === "enter" && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
                  <p className="text-xs text-[var(--color-text-muted)] mb-1">Entry at</p>
                  <p className="font-bold text-lg text-[var(--color-text)]">{merchantName}</p>
                </div>

                {/* Debit / Credit toggle */}
                <div className="flex bg-gray-100 rounded-xl p-1">
                  <button
                    onClick={() => setEntryType("debit")}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      entryType === "debit"
                        ? "bg-white text-[var(--color-danger)] shadow-sm"
                        : "text-gray-500"
                    }`}
                  >
                    Credit Taken
                  </button>
                  <button
                    onClick={() => setEntryType("credit")}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      entryType === "credit"
                        ? "bg-white text-[var(--color-primary)] shadow-sm"
                        : "text-gray-500"
                    }`}
                  >
                    Payment
                  </button>
                </div>

                <div>
                  <label className="text-sm font-medium text-[var(--color-text)]">Amount</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full mt-1 px-4 py-4 bg-white rounded-2xl text-3xl font-bold text-center border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
                    autoFocus
                  />
                  <AmountSuggestions onSelect={(v) => setAmount(String(v))} />
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--color-text)]">Description</label>
                  <input
                    type="text"
                    placeholder="e.g. Rice 10kg, Milk 2L"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full mt-1 px-4 py-3 bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setScanStep("scan")}
                    className="flex-1 py-3.5 bg-gray-100 text-gray-600 rounded-xl font-medium active:scale-[0.98] transition-transform"
                  >
                    Back
                  </button>
                  <button
                    onClick={submitCreditEntry}
                    disabled={!amount || Number(amount) <= 0 || saving}
                    className="flex-1 py-3.5 bg-[var(--color-primary)] text-white rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      "Send Request"
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Success */}
            {scanStep === "success" && (
              <div className="text-center py-4 space-y-6">
                <div className="w-20 h-20 mx-auto rounded-full bg-green-50 flex items-center justify-center">
                  <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[var(--color-text)] mb-1">
                    {entryType === "credit" ? "Payment Sent!" : "Request Sent!"}
                  </h2>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    {entryType === "credit"
                      ? `Payment of Rs. ${Number(amount).toLocaleString()} sent to ${merchantName}.`
                      : `Credit request of Rs. ${Number(amount).toLocaleString()} sent to ${merchantName}.`
                    }<br />
                    Awaiting merchant approval.
                  </p>
                </div>
                <button
                  onClick={closeModal}
                  className="w-full py-3 bg-[var(--color-primary)] text-white rounded-xl font-semibold active:scale-[0.98] transition-transform"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== EDIT PROFILE MODAL ===== */}
      {showEditProfile && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowEditProfile(false); }}
        >
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 animate-slide-up shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg text-[var(--color-text)]">Edit Profile</h2>
              <button onClick={() => setShowEditProfile(false)} className="p-1">
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              {/* Avatar upload */}
              <div className="flex flex-col items-center">
                <label className="relative cursor-pointer group">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-2xl font-bold shadow-md overflow-hidden">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (customerName || customerPhone || "?").charAt(0).toUpperCase()
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                      </svg>
                    </div>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file || !mountedRef.current) return;
                      setAvatarUploading(true);
                      try {
                        const compressed = await resizeImage(file, 512);
                        const reader = new FileReader();
                        reader.onloadend = async () => {
                          const base64 = reader.result as string;
                          if (!mountedRef.current) return;
                          const result = await updateCustomerAvatar(customerPhone, base64);
                          if (result.success && result.avatarUrl && mountedRef.current) {
                            setAvatarUrl(result.avatarUrl);
                            try {
                              const raw = localStorage.getItem(CUSTOMER_STORAGE_KEY);
                              const session = raw ? JSON.parse(raw) : {};
                              session.avatar_url = result.avatarUrl;
                              localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(session));
                            } catch {}
                            addToast("Avatar updated!", "success");
                          } else {
                            addToast(result.error || "Failed to upload avatar", "error");
                          }
                          if (mountedRef.current) setAvatarUploading(false);
                        };
                        reader.readAsDataURL(compressed);
                      } catch {
                        if (mountedRef.current) setAvatarUploading(false);
                        addToast("Failed to process image", "error");
                      }
                    }}
                  />
                </label>
                {avatarUploading && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                    <div className="w-3 h-3 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                    Uploading...
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-[var(--color-text)]">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full mt-1 px-4 py-3 bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--color-text)]">Phone</label>
                <input
                  type="tel"
                  value={editPhone}
                  readOnly
                  className="w-full mt-1 px-4 py-3 bg-gray-100 rounded-xl border border-gray-200 text-gray-500 cursor-not-allowed"
                />
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  Phone number cannot be changed. Contact admin to update.
                </p>
              </div>
              <button
                onClick={() => {
                  if (editName) {
                    setCustomerName(editName);
                    try {
                      const raw = localStorage.getItem(CUSTOMER_STORAGE_KEY);
                      const session = raw ? JSON.parse(raw) : {};
                      session.name = editName;
                      session.phone = customerPhone;
                      if (avatarUrl) session.avatar_url = avatarUrl;
                      localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(session));
                    } catch { /* ignore */ }
                    setShowEditProfile(false);
                    addToast("Profile updated!", "success");
                    loadStats();
                  }
                }}
                disabled={!editName || avatarUploading}
                className="w-full py-3 bg-[var(--color-primary)] text-white rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                {avatarUploading ? "Uploading..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== VOUCHER UPLOAD MODAL ===== */}
      {showVoucherModal && voucherMerchant && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 animate-fade-in"
          onClick={() => setShowVoucherModal(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-t-3xl p-6 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-[var(--color-text)]">Upload Payment Voucher</h3>
              <button onClick={() => setShowVoucherModal(false)} className="p-1">
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-[var(--color-text-muted)] mb-4">
              Paying <strong>{voucherMerchant.name}</strong>? Upload a screenshot of your payment confirmation (bank transfer, e-wallet, etc.).
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Amount Paid</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={voucherAmount}
                  onChange={(e) => setVoucherAmount(e.target.value)}
                  placeholder="e.g. 500"
                  className="w-full px-4 py-3 bg-white rounded-xl text-lg font-bold border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">Payment Screenshot</label>
                <label className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer active:bg-gray-50 transition-colors">
                  {voucherPreview ? (
                    <div className="relative w-full">
                      <img src={voucherPreview} alt="Voucher preview" className="w-full max-h-40 object-contain rounded-lg" />
                      <button
                        onClick={() => { setVoucherFile(null); setVoucherPreview(null); }}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <>
                      <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                      <p className="text-sm text-[var(--color-text-muted)]">Tap to upload screenshot</p>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setVoucherFile(file);
                        setVoucherPreview(URL.createObjectURL(file));
                      }
                    }}
                  />
                </label>
              </div>

              <button
                onClick={async () => {
                  if (!voucherMerchant || !voucherAmount || !voucherFile) return;
                  if (!mountedRef.current) return;
                  setVoucherUploading(true);
                  try {
                    const customer = await findOrCreateCustomer(customerPhone, customerName || undefined);
                    if (!customer?.id) {
                      if (mountedRef.current) addToast("Customer lookup failed", "error");
                      if (mountedRef.current) setVoucherUploading(false);
                      return;
                    }
                    const compressed = await resizeImage(voucherFile, 1024);
                    const result = await submitPaymentVoucher(
                      voucherMerchant.id,
                      customer.id,
                      Number(voucherAmount),
                      compressed
                    );
                    if (result.success) {
                      if (mountedRef.current) addToast("Voucher submitted! Awaiting merchant approval.", "success");
                      if (mountedRef.current) setShowVoucherModal(false);
                      loadStats();
                    } else {
                      if (mountedRef.current) addToast(result.error || "Failed to submit", "error");
                    }
                  } catch {
                    if (mountedRef.current) addToast("Failed to submit voucher", "error");
                  } finally {
                    if (mountedRef.current) setVoucherUploading(false);
                  }
                }}
                disabled={voucherUploading || !voucherAmount || !voucherFile}
                className="w-full py-3 bg-[var(--color-primary)] text-white rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {voucherUploading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  "Submit Voucher"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== PAYMENT METHODS MODAL ===== */}
      {showPaymentMethods && paymentMethodsMerchant && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 animate-fade-in"
          onClick={() => setShowPaymentMethods(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-t-3xl p-6 animate-slide-up max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-[var(--color-text)]">Pay {paymentMethodsMerchant.name}</h3>
              <button onClick={() => setShowPaymentMethods(false)} className="p-1">
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {paymentMethodsLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : paymentMethods.length === 0 ? (
              <div className="text-center py-8 text-[var(--color-text-muted)]">
                <svg className="w-12 h-12 mx-auto mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                </svg>
                <p className="text-sm">No payment methods available</p>
              </div>
            ) : (
              <div className="space-y-3">
                {paymentMethods.map((pm, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-lg">
                        {pm.method_type === "fonepay" ? "🏦" :
                         pm.method_type === "esewa" ? "💳" :
                         pm.method_type === "khalti" ? "💰" :
                         pm.method_type === "nepalpay" ? "🏧" :
                         pm.method_type === "bank_deposit" ? "🏛️" : "💵"}
                      </span>
                      <div>
                        <p className="font-medium text-sm text-[var(--color-text)]">
                          {pm.label || pm.method_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        </p>
                      </div>
                    </div>

                    {pm.qr_url && (
                      <button
                        type="button"
                        onClick={() => {
                          setQrPreviewUrl(pm.qr_url);
                          setQrPreviewLabel(pm.label || pm.method_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
                        }}
                        className="flex justify-center mb-2 group cursor-zoom-in"
                        aria-label={`View ${pm.label || pm.method_type} QR code full size`}
                      >
                        <div className="relative">
                          <img
                            src={pm.qr_url}
                            alt={`${pm.label || pm.method_type} QR code - tap to enlarge`}
                            className="w-32 h-32 object-contain rounded-lg border border-gray-200 bg-white group-hover:border-[var(--color-primary)]/40 group-hover:shadow-md transition-all"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                              const fallback = (e.target as HTMLImageElement).nextElementSibling;
                              if (fallback) (fallback as HTMLElement).style.display = "flex";
                            }}
                          />
                          <div className="hidden w-32 h-32 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
                            <span className="text-xs text-[var(--color-text-muted)]">Image unavailable</span>
                          </div>
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/5 transition-colors rounded-lg">
                            <span className="text-[10px] font-medium text-white bg-black/60 px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                              Tap to enlarge
                            </span>
                          </div>
                        </div>
                      </button>
                    )}

                    {pm.method_type === "bank_deposit" && (
                      <div className="text-xs text-[var(--color-text-muted)] space-y-0.5">
                        {pm.account_holder && <p>Account Holder: <span className="font-medium text-[var(--color-text)]">{pm.account_holder}</span></p>}
                        {pm.account_number && <p>Account No: <span className="font-medium text-[var(--color-text)]">{pm.account_number}</span></p>}
                        {pm.bank_name && <p>Bank: <span className="font-medium text-[var(--color-text)]">{pm.bank_name}</span></p>}
                      </div>
                    )}

                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(
                          pm.method_type === "bank_deposit"
                            ? `${pm.bank_name || ""} ${pm.account_holder || ""} ${pm.account_number || ""}`
                            : pm.label || pm.method_type
                        );
                        addToast("Copied!", "success");
                      }}
                      className="mt-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-[var(--color-text)] active:scale-[0.97] transition-transform"
                    >
                      Copy Details
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== QR PREVIEW LIGHTBOX ===== */}
      {qrPreviewUrl && (
        <div
          ref={qrPreviewRef}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => { setQrPreviewUrl(null); setQrPreviewLabel(""); }}
          role="dialog"
          aria-modal="true"
          aria-label={`QR code preview: ${qrPreviewLabel}`}
        >
          {/* Close button */}
          <button
            onClick={() => { setQrPreviewUrl(null); setQrPreviewLabel(""); }}
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white active:scale-90 transition-transform"
            aria-label="Close QR preview"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* QR code container */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-[90vw] max-h-[85vh] bg-white rounded-2xl shadow-2xl p-4 animate-scale-up flex flex-col items-center"
          >
            <p className="text-sm font-semibold text-gray-700 mb-3 text-center">{qrPreviewLabel}</p>
            <img
              src={qrPreviewUrl}
              alt={`${qrPreviewLabel} QR code - full size`}
              className="max-w-full max-h-[65vh] object-contain rounded-lg"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                const fallback = (e.target as HTMLImageElement).nextElementSibling;
                if (fallback) (fallback as HTMLElement).style.display = "flex";
              }}
            />
            <div className="hidden w-48 h-48 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
              <span className="text-sm text-gray-400">Failed to load QR image</span>
            </div>
            <p className="text-xs text-gray-400 mt-3 text-center">Scan this code with another device to pay</p>
          </div>

          {/* Keyboard hint */}
          <p className="absolute bottom-6 text-xs text-white/50 hidden sm:block">Press ESC to close</p>
        </div>
      )}

      <CustomerBottomNav />

      <PendingApprovalModal
        show={showPendingModal}
        mode="customer"
        amount={Number(amount)}
        shopName={merchantName}
        onViewHistory={() => {
          window.location.href = `/customer/history?merchantId=${merchantId}&shopName=${encodeURIComponent(merchantName)}`;
        }}
        onClose={() => setShowPendingModal(false)}
      />

      <OtherRolePrompt currentRole="customer" />
    </div>
    </CustomerPinGate>
  );
}
