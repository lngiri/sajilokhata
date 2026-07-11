"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import SyncStatus from "@/components/SyncStatus";
import { QRScanner } from "@/components/QRCode";
import { useToast } from "@/components/Toast";
import CustomerBottomNav from "@/components/CustomerBottomNav";
import { createClient } from "@/lib/supabase/client";
import {
  getMerchantByPhone,
  findOrCreateCustomer,
  linkCustomerToMerchant,
  createCreditLog,
  getCustomerStats,
} from "@/lib/actions";

type Flow = "menu" | "scan-qr" | "search-phone" | "enter-amount" | "success";

/** Key used to persist customer session in localStorage */
const CUSTOMER_STORAGE_KEY = "sajilo_customer_session";

export default function CustomerDashboard() {
  const { addToast } = useToast();

  // Customer identity
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");

  // Flow state
  const [flow, setFlow] = useState<Flow>("menu");
  const [merchantId, setMerchantId] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
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

  // Search state
  const [searchPhone, setSearchPhone] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<{
    id: string;
    name: string;
    business_name: string | null;
    business_type: string;
  } | null>(null);
  const [searchError, setSearchError] = useState("");

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
    if (initialized && flow === "menu" && !customerPhone) {
      window.location.href = "/scan";
    }
  }, [initialized, flow, customerPhone]);

  // ================================================================
  // Issue 1: Supabase Realtime — listen for credit_log status changes
  // Shows toast when a merchant approves/rejects a customer's request
  // Uses refs to avoid memory leaks on unmount (critical fix)
  // ================================================================
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

      // Guard: if cleanup already ran while we were awaiting, abort
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
              const verb =
                newStatus === "approved"
                  ? "✅ Approved!"
                  : newStatus === "rejected"
                    ? "❌ Rejected"
                    : `📝 ${newStatus}`;
              addToast(
                `${verb} NPR ${Number(payload.new?.amount || 0).toLocaleString()} request`,
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
      // No data yet — first time customer
    } finally {
      setStatsLoading(false);
    }
  };

  // Shared submit: creates the credit log
  const submitCreditEntry = async () => {
    if (!merchantId || !amount || Number(amount) <= 0) return;
    setSaving(true);

    try {
      const customer = await findOrCreateCustomer(customerPhone, customerName || undefined);
      await linkCustomerToMerchant(merchantId, customer.id);

      await createCreditLog({
        merchant_id: merchantId,
        customer_id: customer.id,
        amount: Number(amount),
        description: description || null,
        type: "debit",
        status: "pending",
        sync_status: "online",
      });

      setFlow("success");
      // Reload stats to reflect new pending entry
      loadStats();
      addToast("Credit request sent! Awaiting merchant approval.", "success");
    } catch (err) {
      console.error("Failed to submit credit entry:", err);
      addToast("Failed to submit. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  // === Scan QR flow ===
  const handleQRScan = useCallback(
    async (data: string) => {
      try {
        // Merchant QR format: JSON with type "merchant_scan"
        const parsed = JSON.parse(data);
        if (parsed.type === "merchant_scan") {
          setMerchantId(parsed.merchantId);
          setMerchantName(parsed.merchantName);
          setFlow("enter-amount");
        } else {
          addToast("Please scan a valid shop QR code.", "error");
        }
      } catch {
        addToast("Invalid QR code. Please scan a valid shop QR.", "error");
      }
    },
    [addToast]
  );

  // === Search merchant by phone ===
  const handleSearch = async () => {
    if (!searchPhone || searchPhone.length < 10) {
      setSearchError("Please enter a valid 10-digit phone number.");
      return;
    }
    setSearching(true);
    setSearchError("");
    setSearchResult(null);

    try {
      const merchant = await getMerchantByPhone(`+977${searchPhone}`);
      if (merchant) {
        setSearchResult(merchant);
      } else {
        setSearchError("No shop found with this phone number.");
      }
    } catch {
      setSearchError("Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  // When merchant is found via search, proceed to enter amount
  const proceedWithMerchant = (m: { id: string; name: string }) => {
    setMerchantId(m.id);
    setMerchantName(m.name);
    setFlow("enter-amount");
  };

  // === Reset for a new transaction ===
  const resetTransaction = () => {
    setMerchantId("");
    setMerchantName("");
    setAmount("");
    setDescription("");
    setFlow("menu");
  };

  // Prevent flash while reading localStorage
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
        <div className="flex items-center px-4 py-3">
          <a href="/" className="mr-3 p-1 active:scale-95 transition-transform">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </a>
          <h1 className="text-lg font-bold text-[var(--color-text)]">
            {flow === "menu" ? "My Dashboard"
              : flow === "scan-qr" ? "Scan Shop QR"
              : flow === "search-phone" ? "Find Shop"
              : flow === "enter-amount" ? "Enter Amount"
              : "Success!"}
          </h1>
          <div className="ml-auto flex items-center gap-2">
            <SyncStatus />
            {customerPhone && (
              <span className="text-[10px] text-[var(--color-text-muted)]">
                ID: {customerPhone.slice(-4)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* ===== MENU ===== */}
        {flow === "menu" && (
          <div className="space-y-4 animate-fade-in">
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
              <a
                href="/scan"
                className="text-xs text-[var(--color-primary)] font-medium px-3 py-1.5 rounded-lg bg-[var(--color-primary)]/5 active:scale-95 transition-transform"
              >
                Change
              </a>
            </div>

            {/* Outstanding Balance Card */}
            {statsLoading ? (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-50 flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : stats ? (
              <div className="bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] rounded-2xl p-5 shadow-sm text-white">
                <p className="text-sm opacity-80 mb-1">Total Outstanding Balance</p>
                <p className="text-3xl font-bold mb-1">
                  NPR {stats.totalOutstanding.toLocaleString()}
                </p>
                <p className="text-xs opacity-60">
                  Across {stats.shopsCount} shop{stats.shopsCount !== 1 ? "s" : ""}
                  {stats.totalCreditLimit > 0 && (
                    <> &middot; Limit NPR {stats.totalCreditLimit.toLocaleString()}</>
                  )}
                </p>

                {stats.relationships.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/20 space-y-2">
                    {stats.relationships.map((rel, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="opacity-80">{rel.merchants?.name || "Unknown Shop"}</span>
                        <span className="font-semibold">NPR {rel.current_balance.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-50 text-center">
                <p className="text-sm text-[var(--color-text-muted)]">
                  No outstanding credit yet
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                  Submit a credit request to get started
                </p>
              </div>
            )}

            {/* Quick Actions */}
            <div className="space-y-2">
              <button
                onClick={() => { resetTransaction(); setFlow("scan-qr"); }}
                className="w-full flex items-center gap-4 p-5 bg-white rounded-2xl shadow-sm border border-gray-50 active:scale-[0.98] transition-transform text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
                  <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-[var(--color-text)]">Scan Shop QR</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Scan the shop&apos;s QR to submit a credit request</p>
                </div>
                <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>

              <button
                onClick={() => { resetTransaction(); setFlow("search-phone"); }}
                className="w-full flex items-center gap-4 p-5 bg-white rounded-2xl shadow-sm border border-gray-50 active:scale-[0.98] transition-transform text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-[var(--color-text)]">Search Shop by Phone</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Find a shop using their registered phone number</p>
                </div>
                <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>

              <a
                href="/customer/history"
                className="w-full flex items-center gap-4 p-5 bg-white rounded-2xl shadow-sm border border-gray-50 active:scale-[0.98] transition-transform text-left"
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
          </div>
        )}

        {/* ===== SCAN QR ===== */}
        {flow === "scan-qr" && (
          <div className="space-y-4 animate-fade-in">
            <div className="text-center">
              <p className="text-sm text-[var(--color-text-muted)]">
                Point your camera at the shop&apos;s QR code
              </p>
            </div>
            <QRScanner onScan={handleQRScan} />
            <button
              onClick={() => setFlow("menu")}
              className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-medium active:scale-[0.98] transition-transform"
            >
              Cancel
            </button>
          </div>
        )}

        {/* ===== SEARCH BY PHONE ===== */}
        {flow === "search-phone" && (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-50 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
                  Shop Phone Number
                </label>
                <div className="flex">
                  <span className="px-3 py-3 bg-gray-100 rounded-l-xl text-sm font-medium text-gray-500 border border-r-0 border-gray-100">
                    +977
                  </span>
                  <input
                    type="tel"
                    placeholder="9841234567"
                    value={searchPhone}
                    onChange={(e) => setSearchPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    className="flex-1 px-4 py-3 bg-white rounded-r-xl text-lg font-mono border border-gray-100 focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none"
                    maxLength={10}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  />
                </div>
              </div>

              <button
                onClick={handleSearch}
                disabled={searchPhone.length < 10 || searching}
                className="w-full py-3 bg-[var(--color-primary)] text-white rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {searching ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  "Search"
                )}
              </button>

              {searchError && (
                <div className="bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-xl flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  {searchError}
                </div>
              )}

              {searchResult && (
                <div
                  onClick={() => proceedWithMerchant(searchResult)}
                  className="bg-green-50 rounded-xl p-4 border border-green-100 cursor-pointer active:scale-[0.98] transition-transform"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-green-800">{searchResult.name}</p>
                      <p className="text-xs text-green-600 capitalize">{searchResult.business_type} Shop</p>
                    </div>
                    <span className="text-xs text-green-700 font-medium px-2.5 py-1 bg-green-100 rounded-full">
                      Select &rarr;
                    </span>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setFlow("menu")}
              className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-medium active:scale-[0.98] transition-transform"
            >
              Back to Menu
            </button>
          </div>
        )}

        {/* ===== ENTER AMOUNT ===== */}
        {flow === "enter-amount" && (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-50 text-center">
              <p className="text-xs text-[var(--color-text-muted)] mb-1">Submitting credit request at</p>
              <p className="font-bold text-lg text-[var(--color-text)]">{merchantName}</p>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-50 space-y-4">
              <div>
                <label className="text-sm font-medium text-[var(--color-text)]">Amount (NPR)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full mt-1 px-4 py-4 bg-white rounded-2xl text-3xl font-bold text-center border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
                  autoFocus
                />
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
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setFlow("menu")}
                className="flex-1 py-3.5 bg-gray-100 text-gray-600 rounded-xl font-medium active:scale-[0.98] transition-transform"
              >
                Cancel
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

        {/* ===== SUCCESS ===== */}
        {flow === "success" && (
          <div className="text-center py-8 space-y-6 animate-fade-in">
            <div className="w-20 h-20 mx-auto rounded-full bg-green-50 flex items-center justify-center">
              <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--color-text)] mb-1">Request Sent!</h2>
              <p className="text-sm text-[var(--color-text-muted)]">
                Credit request of NPR {Number(amount).toLocaleString()} sent to {merchantName}.<br />
                Awaiting merchant approval.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={resetTransaction}
                className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium active:scale-[0.98] transition-transform"
              >
                New Request
              </button>
              <a
                href="/customer/history"
                className="flex-1 py-3 bg-[var(--color-primary)] text-white rounded-xl font-medium active:scale-[0.98] transition-transform inline-flex items-center justify-center"
              >
                View History
              </a>
            </div>
          </div>
        )}
      </div>

      <CustomerBottomNav />
    </div>
  );
}
