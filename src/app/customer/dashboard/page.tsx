"use client";

import { useState, useCallback, useEffect } from "react";
import { QRScanner } from "@/components/QRCode";
import { useToast } from "@/components/Toast";
import {
  getMerchantByPhone,
  findOrCreateCustomer,
  linkCustomerToMerchant,
  createCreditLog,
  getCustomerCreditLogs,
} from "@/lib/actions";

type Flow = "menu" | "scan-qr" | "search-phone" | "enter-amount" | "confirm" | "history" | "success";

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

  // History state
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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
    }
  }, []);

  // If no customer phone, redirect to scan page to set it up
  useEffect(() => {
    if (flow === "menu" && !customerPhone) {
      window.location.href = "/scan";
    }
  }, [flow, customerPhone]);

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

  // === Load history ===
  const loadHistory = async () => {
    if (!customerPhone) return;
    setHistoryLoading(true);
    try {
      const logs = await getCustomerCreditLogs(customerPhone, { limit: 20 });
      setHistory(logs);
    } catch {
      addToast("Failed to load history.", "error");
    } finally {
      setHistoryLoading(false);
    }
  };

  // === Reset for a new transaction ===
  const resetTransaction = () => {
    setMerchantId("");
    setMerchantName("");
    setAmount("");
    setDescription("");
    setFlow("menu");
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-amber-50 text-amber-700";
      case "approved":
        return "bg-green-50 text-green-700";
      case "rejected":
        return "bg-red-50 text-red-700";
      default:
        return "bg-gray-50 text-gray-600";
    }
  };

  return (
    <div className="min-h-dvh bg-[var(--color-bg)] pb-8">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center px-4 py-3">
          <a href="/" className="mr-3 p-1 active:scale-95 transition-transform">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </a>
          <h1 className="text-lg font-bold text-[var(--color-text)]">
            {flow === "menu" ? "Customer Dashboard"
              : flow === "scan-qr" ? "Scan Shop QR"
              : flow === "search-phone" ? "Find Shop"
              : flow === "enter-amount" ? "Enter Amount"
              : flow === "confirm" ? "Confirm Entry"
              : flow === "history" ? "My Requests"
              : "Success!"}
          </h1>
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

            {/* Action cards */}
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

              <button
                onClick={() => { loadHistory(); setFlow("history"); }}
                className="w-full flex items-center gap-4 p-5 bg-white rounded-2xl shadow-sm border border-gray-50 active:scale-[0.98] transition-transform text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-[var(--color-text)]">My Requests</p>
                  <p className="text-xs text-[var(--color-text-muted)]">View your credit request history and status</p>
                </div>
                <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
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
                      Select →
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
              <button
                onClick={() => { loadHistory(); setFlow("history"); }}
                className="flex-1 py-3 bg-[var(--color-primary)] text-white rounded-xl font-medium active:scale-[0.98] transition-transform"
              >
                View My Requests
              </button>
            </div>
          </div>
        )}

        {/* ===== HISTORY ===== */}
        {flow === "history" && (
          <div className="space-y-3 animate-fade-in">
            {historyLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-12 text-[var(--color-text-muted)]">
                <svg className="w-16 h-16 mx-auto mb-3 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="font-medium">No requests yet</p>
                <p className="text-sm mt-1">Scan a shop QR or search by phone to submit your first request.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((log: any) => (
                  <div key={log.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-50">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${log.type === "debit" ? "bg-amber-50" : "bg-green-50"}`}>
                        <span className="text-lg font-bold text-amber-600">{log.type === "debit" ? "+" : "-"}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-[var(--color-text)] truncate">
                          {log.merchants?.name || "Shop"}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)] truncate">
                          {log.description || "No description"}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-sm text-[var(--color-danger)]">
                          NPR {log.amount.toLocaleString()}
                        </p>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium capitalize mt-1 ${statusBadge(log.status)}`}>
                          {log.status}
                        </span>
                      </div>
                    </div>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-2">
                      {new Date(log.created_at).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setFlow("menu")}
              className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-medium active:scale-[0.98] transition-transform"
            >
              Back to Menu
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
