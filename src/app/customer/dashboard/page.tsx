"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import SyncStatus from "@/components/SyncStatus";
import PullToRefresh from "@/components/PullToRefresh";
import { QRScanner } from "@/components/QRCode";
import { useToast } from "@/components/Toast";
import { playSuccessSound } from "@/lib/sound";
import AmountSuggestions from "@/components/AmountSuggestions";
import PendingApprovalModal from "@/components/PendingApprovalModal";
import CustomerBottomNav from "@/components/CustomerBottomNav";
import RoleSwitcher from "@/components/RoleSwitcher";
import { createClient } from "@/lib/supabase/client";
import { isOnline, savePendingLog } from "@/lib/offline/db";
import {
  findOrCreateCustomer,
  linkCustomerToMerchant,
  createCreditLog,
  getCustomerStats,
} from "@/lib/actions";

/** Key used to persist customer session in localStorage */
const CUSTOMER_STORAGE_KEY = "sajilo_customer_session";

export default function CustomerDashboard() {
  const { addToast } = useToast();

  // Customer identity
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [initialized, setInitialized] = useState(false);

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

  // Edit profile modal
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");

  // On mount, restore customer session from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CUSTOMER_STORAGE_KEY);
      if (raw) {
        const session = JSON.parse(raw);
        if (session.phone) {
          setCustomerPhone(session.phone);
          setCustomerName(session.name || "");
        }
      }
    } catch {
      // Ignore
    } finally {
      setInitialized(true);
    }
  }, []);

  // Load stats when phone is available
  useEffect(() => {
    if (initialized && customerPhone) {
      loadStats();
    }
  }, [initialized, customerPhone]);

  // If no customer phone, redirect to scan page to set it up
  useEffect(() => {
    if (initialized && !customerPhone) {
      window.location.href = "/scan";
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

    const loadStatsRef = loadStats;
    const supabase = realtimeClientRef.current;

    const setupRealtime = async () => {
      const { data: customers } = await supabase
        .from("customers")
        .select("id")
        .eq("phone", customerPhone);

      if (!realtimeSetupStartedRef.current) return;
      if (!customers || customers.length === 0) return;

      const customerIds = customers.map((c: any) => c.id);

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
              loadStatsRef();
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

  const loadStats = async () => {
    if (!customerPhone) return;
    setStatsLoading(true);
    try {
      const data = await getCustomerStats(customerPhone);
      setStats(data);
    } catch {
      // No data yet
    } finally {
      setStatsLoading(false);
    }
  };

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

  // Submit credit entry from modal
  const submitCreditEntry = async () => {
    if (!merchantId || !amount || Number(amount) <= 0) return;
    setSaving(true);
    try {
      if (isOnline()) {
        const customer = await findOrCreateCustomer(customerPhone, customerName || undefined);
        await linkCustomerToMerchant(merchantId, customer.id);
        await createCreditLog({
          merchant_id: merchantId,
          customer_id: customer.id,
          amount: Number(amount),
          description: description || null,
          type: entryType,
          status: "pending",
          sync_status: "online",
        });
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
    setTimeout(() => {
      setScanStep("scan");
      setMerchantId("");
      setMerchantName("");
      setAmount("");
      setDescription("");
      setEntryType("debit");
    }, 200);
  };

  // Prevent flash while reading localStorage
  if (!initialized) {
    return (
      <div className="min-h-dvh bg-[var(--color-bg)] flex items-center justify-center">
        <div role="status" className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[var(--color-bg)] pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center px-4 py-3">
          <a href="/" className="mr-3 p-1 active:scale-95 transition-transform">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </a>
          <div>
            <h1 className="text-lg font-bold text-[var(--color-text)]">My Dashboard</h1>
            <p className="text-[10px] text-[var(--color-text-muted)]">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "Asia/Kathmandu" })}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <SyncStatus />
            <RoleSwitcher />
            {customerPhone && (
              <span className="text-[10px] text-[var(--color-text-muted)]">
                ID: {customerPhone.slice(-4)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ===== ALWAYS-VISIBLE DASHBOARD CONTENT ===== */}
      <PullToRefresh onRefresh={loadStats}>
      <div className="px-4 py-4 space-y-4">
        {/* Customer identity badge */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-medium text-[var(--color-text)]">{customerName || customerPhone}</p>
            <p className="text-xs text-[var(--color-text-muted)]">{customerName ? customerPhone : ""}</p>
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
                {stats.relationships.map((rel, i) => (
                  <a
                    key={i}
                    href={`/customer/history?merchantId=${rel.merchants?.id || ""}&shopName=${encodeURIComponent(rel.merchants?.name || "Shop")}`}
                    className="flex items-center justify-between text-sm py-1.5 -mx-1 px-2 rounded-lg active:bg-white/10 transition-colors"
                  >
                    <span className="opacity-80">{rel.merchants?.name || "Unknown Shop"}</span>
                    <span className="font-semibold">Rs. {rel.current_balance.toLocaleString()}</span>
                  </a>
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

      {/* ===== FLOATING QR SCAN FAB ===== */}
      <button
        onClick={() => { setShowScanner(true); setScanStep("scan"); }}
        className="fixed bottom-24 right-4 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] shadow-lg flex items-center justify-center active:scale-90 transition-transform hover:shadow-xl"
      >
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
        </svg>
      </button>

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
                  <label className="text-sm font-medium text-[var(--color-text)]">Amount (Rs.)</label>
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
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full mt-1 px-4 py-3 bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
                />
              </div>
              <button
                onClick={() => {
                  if (editPhone) {
                    setCustomerName(editName);
                    setCustomerPhone(editPhone);
                    try {
                      localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify({ name: editName, phone: editPhone }));
                    } catch { /* ignore */ }
                    setShowEditProfile(false);
                    addToast("Profile updated!", "success");
                    loadStats();
                  }
                }}
                disabled={!editPhone}
                className="w-full py-3 bg-[var(--color-primary)] text-white rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
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
    </div>
  );
}
