"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { QRScanner } from "@/components/QRCode";
import { useToast } from "@/components/Toast";
import AmountSuggestions from "@/components/AmountSuggestions";
import BottomNav from "@/components/BottomNav";
import { getCurrentMerchantId } from "@/lib/auth";
import {
  findOrCreateCustomer,
  linkCustomerToMerchant,
  createCreditLog,
  createManualCreditLog,
  getMerchantCustomers,
  getMerchantCustomerBalance,
} from "@/lib/actions";
import { useSearchParams } from "next/navigation";

type Step = "scan" | "enter" | "confirm" | "success";

/** Prefix that identifies a customer identity QR */
const CUSTOMER_QR_PREFIX = "sajilokhata:customer:";

interface CustomerOption {
  id: string;
  name: string | null;
  phone: string;
  current_balance: number;
}

export default function MerchantScanPage() {
  const { addToast } = useToast();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("scan");
  const isManual = searchParams?.get("manual") === "true";

  useEffect(() => {
    if (isManual) {
      setStep("enter");
    }
  }, [isManual]);

  // Shared state
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [entryType, setEntryType] = useState<"debit" | "credit">("debit");
  const [saving, setSaving] = useState(false);
  const [merchantId, setMerchantId] = useState<string | null>(null);

  // Manual mode state
  const [customerList, setCustomerList] = useState<CustomerOption[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [customerBalance, setCustomerBalance] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load merchant ID and customer list on mount
  useEffect(() => {
    getCurrentMerchantId().then(setMerchantId);
  }, []);

  useEffect(() => {
    if (isManual && merchantId) {
      getMerchantCustomers(merchantId).then((data) => {
        const mapped: CustomerOption[] = (data || []).map((r: any) => ({
          id: r.customers?.id || r.customer_id,
          name: r.customers?.name || null,
          phone: r.customers?.phone || "",
          current_balance: r.current_balance || 0,
        }));
        setCustomerList(mapped.sort((a, b) => (a.name || a.phone).localeCompare(b.name || b.phone)));
      });
    }
  }, [isManual, merchantId]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredCustomers = customerList.filter(
    (c) =>
      (c.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery)
  );

  const handleSelectCustomer = async (c: CustomerOption) => {
    setCustomerId(c.id);
    setCustomerPhone(c.phone);
    setCustomerName(c.name);
    setSearchQuery(c.name || c.phone);
    setShowDropdown(false);
    if (merchantId) {
      try {
        const { balance } = await getMerchantCustomerBalance(merchantId, c.id);
        setCustomerBalance(balance);
      } catch {
        setCustomerBalance(null);
      }
    }
  };

  const handleScan = useCallback(
    (data: string) => {
      try {
        if (data.startsWith(CUSTOMER_QR_PREFIX)) {
          const phone = data.slice(CUSTOMER_QR_PREFIX.length);
          if (phone.length < 6) {
            addToast("Invalid customer QR code.", "error");
            return;
          }
          setCustomerPhone(phone);
          setStep("enter");
          return;
        }

        try {
          const parsed = JSON.parse(data);
          if (parsed.type === "reverse_scan") {
            const phone = parsed.customerId;
            if (phone && phone.length >= 6) {
              setCustomerPhone(phone);
              if (parsed.amount) setAmount(String(parsed.amount));
              if (parsed.description) setDescription(parsed.description);
              setStep("enter");
              return;
            }
          }
        } catch {
          // Not JSON
        }

        addToast("Please scan a valid customer QR code.", "error");
      } catch {
        addToast("Invalid QR code format.", "error");
      }
    },
    [addToast]
  );

  const handleEnterNext = () => {
    if (!customerId || !customerPhone) {
      addToast("Please select or enter a valid customer.", "error");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      addToast("Please enter a valid amount.", "error");
      return;
    }
    setStep("confirm");
  };

  const handleConfirm = async () => {
    setSaving(true);

    try {
      const mId = await getCurrentMerchantId();
      if (!mId) {
        addToast("Not logged in", "error");
        setSaving(false);
        return;
      }

      let cId = customerId;
      let cName = customerName;

      // For manual mode, customer is already selected by ID
      if (isManual && cId) {
        // Use existing customer ID from selection
      } else {
        // QR scan mode — find or create by phone
        const customer = await findOrCreateCustomer(customerPhone, customerName || undefined);
        cId = customer.id;
        cName = customer.name || null;
        setCustomerName(cName);
        await linkCustomerToMerchant(mId, customer.id);
      }

      if (isManual) {
        await createManualCreditLog({
          merchant_id: mId,
          customer_id: cId!,
          amount: Number(amount),
          type: entryType,
          description: description || null,
        });
      } else {
        await createCreditLog({
          merchant_id: mId,
          customer_id: cId!,
          amount: Number(amount),
          description: description || null,
          type: entryType,
          status: "pending",
          sync_status: "online",
        });
      }

      setStep("success");
      addToast("Entry saved! Customer notified.", "success");
    } catch (err) {
      console.error("Failed to save entry:", err);
      addToast("Failed to save. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setStep("scan");
    setCustomerPhone("");
    setCustomerName(null);
    setCustomerId(null);
    setCustomerBalance(null);
    setAmount("");
    setDescription("");
    setEntryType("debit");
    setSearchQuery("");
    setShowDropdown(false);
  };

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center px-4 py-3">
          <a
            href="/merchant/dashboard"
            className="mr-3 p-1 active:scale-95 transition-transform"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 19.5L8.25 12l7.5-7.5"
              />
            </svg>
          </a>
          <h1 className="text-lg font-bold text-[var(--color-text)]">
            {step === "scan"
              ? "Scan Customer QR"
              : step === "enter"
              ? isManual ? "Manual Entry" : "Enter Details"
              : step === "confirm"
              ? "Confirm Entry"
              : "Entry Saved!"}
          </h1>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Step 1: Scan QR */}
        {step === "scan" && (
          <div className="space-y-4 animate-fade-in">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-[var(--color-primary)]/10 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-[var(--color-primary)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z"
                  />
                </svg>
              </div>
              <p className="text-sm text-[var(--color-text-muted)]">
                Point your camera at the customer&apos;s QR code
              </p>
            </div>

            <QRScanner onScan={handleScan} />
          </div>
        )}

        {/* Step 2: Enter Details */}
        {step === "enter" && (
          <div className="space-y-4 animate-fade-in">
            {/* QR scan mode — read-only customer phone */}
            {!isManual && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--color-text-muted)]">Customer Phone</p>
                    <p className="font-mono font-medium text-[var(--color-text)]">{customerPhone}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Manual mode — hybrid search + dropdown */}
            {isManual && (
              <div ref={dropdownRef} className="relative">
                <label className="text-sm font-medium text-[var(--color-text)]">Search Customer (Name or Phone)</label>
                <input
                  type="text"
                  placeholder="e.g. Ram Sharma or 9841..."
                  value={searchQuery}
                  onFocus={() => setShowDropdown(true)}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowDropdown(true);
                    // Clear selection when query changes
                    if (!customerList.find((c) => (c.name || c.phone) === e.target.value)) {
                      setCustomerId(null);
                      setCustomerPhone("");
                      setCustomerName(null);
                      setCustomerBalance(null);
                    }
                  }}
                  className="w-full mt-1 px-4 py-3 bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
                />
                {showDropdown && filteredCustomers.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full bg-white rounded-xl shadow-lg border border-gray-100 max-h-48 overflow-y-auto">
                    {filteredCustomers.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectCustomer(c)}
                        className="w-full text-left px-4 py-2.5 hover:bg-[var(--color-primary)]/5 active:bg-[var(--color-primary)]/10 transition-colors flex items-center justify-between"
                      >
                        <div>
                          <p className="text-sm font-medium text-[var(--color-text)]">{c.name || "Unknown"}</p>
                          <p className="text-xs text-[var(--color-text-muted)]">{c.phone}</p>
                        </div>
                        {c.current_balance > 0 && (
                          <span className="text-xs font-medium text-red-600">Due: NPR {c.current_balance.toLocaleString()}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {showDropdown && searchQuery && filteredCustomers.length === 0 && (
                  <div className="absolute z-50 mt-1 w-full bg-white rounded-xl shadow-lg border border-gray-100 p-4 text-center">
                    <p className="text-sm text-[var(--color-text-muted)]">No customers found</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">
                      The customer will be created automatically on save
                    </p>
                  </div>
                )}

                {/* Balance display */}
                {customerBalance !== null && (
                  <div className={`mt-2 px-3 py-2 rounded-lg text-sm font-medium ${customerBalance > 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                    {customerBalance > 0
                      ? `Current Due: NPR ${customerBalance.toLocaleString()}`
                      : "No outstanding balance"}
                  </div>
                )}
              </div>
            )}

            {/* Type Toggle */}
            {isManual && (
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50">
                <p className="text-sm font-medium text-[var(--color-text)] mb-3">Transaction Type</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEntryType("debit")}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      entryType === "debit"
                        ? "bg-red-600 text-white shadow-sm"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    Credit Given (उधारो)
                  </button>
                  <button
                    onClick={() => setEntryType("credit")}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      entryType === "credit"
                        ? "bg-green-600 text-white shadow-sm"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    Amount Received (पैसा)
                  </button>
                </div>
              </div>
            )}

            {/* Amount + Description */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-50 space-y-4">
              <div>
                <label className="text-sm font-medium text-[var(--color-text)]">Amount (NPR)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full mt-1 px-4 py-4 bg-white rounded-2xl text-3xl font-bold text-center border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
                  autoFocus={!isManual}
                />
                <AmountSuggestions onSelect={(v) => setAmount(String(v))} />
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--color-text)]">Description</label>
                <input
                  type="text"
                  maxLength={200}
                  placeholder={entryType === "debit" ? "e.g. Rice 10kg, Milk 2L" : "e.g. Payment for last week"}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full mt-1 px-4 py-3 bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleReset}
                className="flex-1 py-3.5 bg-gray-100 text-gray-600 rounded-xl font-medium active:scale-[0.98] transition-transform"
              >
                Cancel
              </button>
              <button
                onClick={handleEnterNext}
                disabled={!amount || Number(amount) <= 0}
                className="flex-1 py-3.5 bg-[var(--color-primary)] text-white rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === "confirm" && (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-50 space-y-4">
              <div className="text-center pb-2 border-b border-gray-50">
                <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-green-50 flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-xs text-[var(--color-text-muted)]">Review Entry Details</p>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Customer</p>
                  <p className="font-medium text-[var(--color-text)]">{customerName || customerPhone}</p>
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Amount</p>
                    <p className={`text-2xl font-bold ${entryType === "debit" ? "text-red-600" : "text-green-600"}`}>
                      NPR {Number(amount).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Type</p>
                    <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${
                      entryType === "debit"
                        ? "bg-red-50 text-red-700"
                        : "bg-green-50 text-green-700"
                    }`}>
                      {entryType === "debit" ? "Credit Given (उधारो)" : "Amount Received (पैसा)"}
                    </span>
                  </div>
                </div>
                {description && (
                  <div>
                    <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Description</p>
                    <p className="text-sm text-[var(--color-text)]">{description}</p>
                  </div>
                )}
                {isManual && (
                  <div className="bg-amber-50 rounded-xl p-3 flex items-start gap-2">
                    <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    <p className="text-xs text-amber-800">
                      This entry will appear as &quot;Unverified&quot; on the customer&apos;s side. They must confirm it to mark it approved.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep("enter")}
                disabled={saving}
                className="flex-1 py-3.5 bg-gray-100 text-gray-600 rounded-xl font-medium active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                Edit
              </button>
              <button
                onClick={handleConfirm}
                disabled={saving}
                className="flex-1 py-3.5 bg-[var(--color-primary)] text-white rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    Save Entry
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Success */}
        {step === "success" && (
          <div className="text-center py-8 space-y-6 animate-fade-in">
            <div className="w-20 h-20 mx-auto rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center">
              <svg className="w-10 h-10 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--color-text)] mb-1">Entry Saved!</h2>
              <p className="text-sm text-[var(--color-text-muted)]">
                {customerName
                  ? `${entryType === "debit" ? "Credit" : "Payment"} of NPR ${Number(amount).toLocaleString()} for ${customerName}`
                  : `NPR ${Number(amount).toLocaleString()} saved`}
              </p>
              {isManual && (
                <p className="text-xs text-amber-600 mt-2">
                  Waiting for customer confirmation
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleReset}
                className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium active:scale-[0.98] transition-transform"
              >
                {isManual ? "New Entry" : "Scan Another"}
              </button>
              <a
                href="/merchant/logs"
                className="flex-1 py-3 bg-[var(--color-primary)] text-white rounded-xl font-medium active:scale-[0.98] transition-transform flex items-center justify-center"
              >
                View Ledger
              </a>
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
