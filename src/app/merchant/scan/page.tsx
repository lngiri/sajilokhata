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
import { sanitizePhoneForUrl } from "@/lib/phone";


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
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Defer client-only URL check until after hydration to prevent mismatch
  const isManual = isMounted && searchParams?.get("manual") === "true";
  const [step, setStep] = useState<Step>("scan");

  // Shared state
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [entryType, setEntryType] = useState<"debit" | "credit" | "cash">("debit");
  const [saving, setSaving] = useState(false);
  const [merchantId, setMerchantId] = useState<string | null>(null);

  // Manual mode state
  const [customerList, setCustomerList] = useState<CustomerOption[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [customerBalance, setCustomerBalance] = useState<number | null>(null);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load merchant ID and customer list on mount
  useEffect(() => {
    getCurrentMerchantId().then(setMerchantId);
  }, []);

  useEffect(() => {
    if (isManual && step === "scan") {
      setStep("enter");
    }
  }, [isManual, step]);

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
    if (entryType !== "cash" && (!customerId || !customerPhone)) {
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

      const isCash = entryType === "cash";
      let cId = customerId;
      let cName = customerName;

      if (isCash) {
        // Cash sales: customer is optional (walk-in anonymous)
        if (!cId && customerPhone) {
          const customer = await findOrCreateCustomer(customerPhone, customerName || undefined);
          cId = customer.id;
          cName = customer.name || null;
          setCustomerName(cName);
          await linkCustomerToMerchant(mId, customer.id);
        }
      } else {
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
      }

      if (isManual) {
        const entry = await createManualCreditLog({
          merchant_id: mId,
          customer_id: cId ?? undefined,
          amount: Number(amount),
          type: entryType,
          description: description || null,
        });
        if (entry?.verification_token) {
          setVerificationToken(entry.verification_token);
        }
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
      addToast(isCash ? "Cash sale recorded!" : "Entry saved! Customer notified.", "success");
    } catch (err) {
      console.error("Failed to save entry:", err);
      addToast("Failed to save. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setStep(isManual ? "enter" : "scan");
    setCustomerPhone("");
    setCustomerName(null);
    setCustomerId(null);
    setCustomerBalance(null);
    setAmount("");
    setDescription("");
    setEntryType("debit");
    setVerificationToken(null);
    setSearchQuery("");
    setShowDropdown(false);
  };

  // ─── Hydration guard: return matching skeleton until mounted ────
  if (!isMounted) {
    return <div className="min-h-screen bg-gray-50" />;
  }

  // ─── Manual mode: short-circuit, no camera ──────────────────────
  if (isManual) {
    return (
      <div className="pb-20">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
          <div className="flex items-center px-4 py-3">
            <a href="/merchant/dashboard" className="mr-3 p-1 active:scale-95 transition-transform">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </a>
            <h1 className="text-lg font-bold text-[var(--color-text)]">
              {step === "enter" ? "Manual Entry" : step === "confirm" ? "Confirm Entry" : "Entry Saved!"}
            </h1>
          </div>
        </div>

        <div className="px-4 py-4 space-y-4">
          {/* Manual: Enter Details */}
          {step === "enter" && (
            <div className="space-y-4 animate-fade-in">
              <div ref={dropdownRef} className="relative">
                <label className="text-sm font-medium text-[var(--color-text)]">
                  {entryType === "cash" ? "Customer (Optional)" : "Search Customer (Name or Phone)"}
                </label>
                <input
                  type="text"
                  placeholder={entryType === "cash" ? "e.g. Ram Sharma or leave blank for walk-in" : "e.g. Ram Sharma or 9841..."}
                  value={searchQuery}
                  onFocus={() => setShowDropdown(true)}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowDropdown(true);
                    if (!customerList.find((c) => (c.name || c.phone) === e.target.value)) {
                      setCustomerId(null);
                      setCustomerPhone(e.target.value);
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
                      {entryType === "cash" ? "Leave blank for walk-in cash sale" : "The customer will be created automatically on save"}
                    </p>
                  </div>
                )}
                {customerBalance !== null && entryType !== "cash" && (
                  <div className={`mt-2 px-3 py-2 rounded-lg text-sm font-medium ${customerBalance > 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                    {customerBalance > 0 ? `Current Due: NPR ${customerBalance.toLocaleString()}` : "No outstanding balance"}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50">
                <p className="text-sm font-medium text-[var(--color-text)] mb-3">Transaction Type</p>
                <div className="flex gap-2">
                  <button onClick={() => setEntryType("debit")}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${entryType === "debit" ? "bg-red-600 text-white shadow-sm" : "bg-gray-100 text-gray-500"}`}>
                    Credit Given (उधारो)
                  </button>
                  <button onClick={() => setEntryType("credit")}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${entryType === "credit" ? "bg-green-600 text-white shadow-sm" : "bg-gray-100 text-gray-500"}`}>
                    Amount Received (पैसा)
                  </button>
                  <button onClick={() => setEntryType("cash")}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${entryType === "cash" ? "bg-blue-600 text-white shadow-sm" : "bg-gray-100 text-gray-500"}`}>
                    Cash Sale (नगद बिक्री)
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-50 space-y-4">
                <div>
                  <label className="text-sm font-medium text-[var(--color-text)]">Amount (NPR)</label>
                  <input type="number" min="1" step="1" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus
                    className="w-full mt-1 px-4 py-4 bg-white rounded-2xl text-3xl font-bold text-center border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all" />
                  <AmountSuggestions onSelect={(v) => setAmount(String(v))} />
                </div>
                <div>
                  <label className="text-sm font-medium text-[var(--color-text)]">Description</label>
                  <input type="text" maxLength={200} placeholder={entryType === "debit" ? "e.g. Rice 10kg, Milk 2L" : entryType === "cash" ? "e.g. Grossery items" : "e.g. Payment for last week"} value={description} onChange={(e) => setDescription(e.target.value)}
                    className="w-full mt-1 px-4 py-3 bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all" />
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={handleReset} className="flex-1 py-3.5 bg-gray-100 text-gray-600 rounded-xl font-medium active:scale-[0.98] transition-transform">Cancel</button>
                <button onClick={handleEnterNext} disabled={!amount || Number(amount) <= 0}
                  className="flex-1 py-3.5 bg-[var(--color-primary)] text-white rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50">Continue</button>
              </div>
            </div>
          )}

          {/* Manual: Confirm */}
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
                    <p className="font-medium text-[var(--color-text)]">
                      {entryType === "cash" && !customerName && !customerPhone
                        ? "Walk-in Customer"
                        : (customerName || customerPhone || "—")}
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Amount</p>
                      <p className={`text-2xl font-bold ${entryType === "debit" ? "text-red-600" : entryType === "cash" ? "text-blue-600" : "text-green-600"}`}>NPR {Number(amount).toLocaleString()}</p>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Type</p>
                      <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${entryType === "debit" ? "bg-red-50 text-red-700" : entryType === "cash" ? "bg-blue-50 text-blue-700" : "bg-green-50 text-green-700"}`}>
                        {entryType === "debit" ? "Credit Given (उधारो)" : entryType === "cash" ? "Cash Sale (नगद बिक्री)" : "Amount Received (पैसा)"}
                      </span>
                    </div>
                  </div>
                  {description && (
                    <div>
                      <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Description</p>
                      <p className="text-sm text-[var(--color-text)]">{description}</p>
                    </div>
                  )}
                  {entryType === "cash" ? (
                    <div className="bg-blue-50 rounded-xl p-3 flex items-start gap-2">
                      <svg className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                      <p className="text-xs text-blue-800">Cash sale will be recorded immediately. No customer confirmation needed.</p>
                    </div>
                  ) : (
                    <div className="bg-amber-50 rounded-xl p-3 flex items-start gap-2">
                      <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                      <p className="text-xs text-amber-800">This entry will appear as "Unverified" on the customer's side. They must confirm it to mark it approved.</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep("enter")} disabled={saving} className="flex-1 py-3.5 bg-gray-100 text-gray-600 rounded-xl font-medium active:scale-[0.98] transition-transform disabled:opacity-50">Edit</button>
                <button onClick={handleConfirm} disabled={saving} className="flex-1 py-3.5 bg-[var(--color-primary)] text-white rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>Save Entry</>}
                </button>
              </div>
            </div>
          )}

          {/* Manual: Success */}
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
                  {entryType === "cash"
                    ? `Cash Sale of NPR ${Number(amount).toLocaleString()}${customerName ? ` from ${customerName}` : ""}`
                    : `${customerName ? `${entryType === "debit" ? "Credit" : "Payment"} of NPR ${Number(amount).toLocaleString()} for ${customerName}` : `NPR ${Number(amount).toLocaleString()} saved`}`}
                </p>
                {entryType === "cash" ? (
                  <p className="text-xs text-blue-600 mt-2">Cash sale recorded and approved</p>
                ) : (
                  <p className="text-xs text-amber-600 mt-2">Waiting for customer confirmation</p>
                )}
                {verificationToken && customerPhone && entryType !== "cash" && (
                  <>
                    <div className="flex gap-2 mt-3">
                      <a
                        href={`https://wa.me/${sanitizePhoneForUrl(customerPhone)}?text=${encodeURIComponent(
                          (() => {
                            const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://qrhisab.vercel.app';
                            const shareLink = `${baseUrl}/verify?token=${verificationToken}`;
                            return `नमस्ते, तपाईंको खातामा NPR ${Number(amount).toLocaleString()} को कारोबार थपिएको छ। कृपया यो लिंकमा गई स्वीकृत गर्नुहोला: ${shareLink}`;
                          })()
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium active:scale-[0.98] transition-transform"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                        Share via WhatsApp
                      </a>
                      <button
                        onClick={async () => {
                          const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://qrhisab.vercel.app';
                          const link = `${baseUrl}/verify?token=${verificationToken}`;
                          try {
                            await navigator.clipboard.writeText(link);
                            addToast("लिंक कपि गरियो! (Link copied!)", "success");
                          } catch {
                            addToast("कपि गर्न सकिएन (Failed to copy)", "error");
                          }
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium active:scale-[0.98] transition-transform hover:bg-gray-200"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                        </svg>
                        Copy Link (लिंक कपि)
                      </button>
                    </div>
                  </>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={handleReset} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium active:scale-[0.98] transition-transform">New Entry</button>
                <a href="/merchant/logs" className="flex-1 py-3 bg-[var(--color-primary)] text-white rounded-xl font-medium active:scale-[0.98] transition-transform flex items-center justify-center">View Ledger</a>
              </div>
            </div>
          )}
        </div>

        <BottomNav />
      </div>
    );
  }

  // ─── QR scan mode ──────────────────────────────────────────────
  return (
    <div className="pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center px-4 py-3">
          <a href="/merchant/dashboard" className="mr-3 p-1 active:scale-95 transition-transform">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </a>
          <h1 className="text-lg font-bold text-[var(--color-text)]">
            {step === "scan" ? "Scan Customer QR" : step === "enter" ? "Enter Details" : step === "confirm" ? "Confirm Entry" : "Entry Saved!"}
          </h1>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* QR: Scan */}
        {step === "scan" && (
          <div className="space-y-4 animate-fade-in">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-[var(--color-primary)]/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
                </svg>
              </div>
              <p className="text-sm text-[var(--color-text-muted)]">Point your camera at the customer&apos;s QR code</p>
            </div>
            <QRScanner onScan={handleScan} />
          </div>
        )}

        {/* QR: Enter Details */}
        {step === "enter" && (
          <div className="space-y-4 animate-fade-in">
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

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-50 space-y-4">
              <div>
                <label className="text-sm font-medium text-[var(--color-text)]">Amount (NPR)</label>
                <input type="number" min="1" step="1" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus
                  className="w-full mt-1 px-4 py-4 bg-white rounded-2xl text-3xl font-bold text-center border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all" />
                <AmountSuggestions onSelect={(v) => setAmount(String(v))} />
              </div>
              <div>
                <label className="text-sm font-medium text-[var(--color-text)]">Description</label>
                <input type="text" maxLength={200} placeholder={entryType === "debit" ? "e.g. Rice 10kg, Milk 2L" : "e.g. Payment for last week"} value={description} onChange={(e) => setDescription(e.target.value)}
                  className="w-full mt-1 px-4 py-3 bg-white rounded-xl border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all" />
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={handleReset} className="flex-1 py-3.5 bg-gray-100 text-gray-600 rounded-xl font-medium active:scale-[0.98] transition-transform">Cancel</button>
              <button onClick={handleEnterNext} disabled={!amount || Number(amount) <= 0}
                className="flex-1 py-3.5 bg-[var(--color-primary)] text-white rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50">Continue</button>
            </div>
          </div>
        )}

        {/* QR: Confirm */}
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
                    <p className={`text-2xl font-bold ${entryType === "debit" ? "text-red-600" : "text-green-600"}`}>NPR {Number(amount).toLocaleString()}</p>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Type</p>
                    <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${entryType === "debit" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
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
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep("enter")} disabled={saving} className="flex-1 py-3.5 bg-gray-100 text-gray-600 rounded-xl font-medium active:scale-[0.98] transition-transform disabled:opacity-50">Edit</button>
              <button onClick={handleConfirm} disabled={saving} className="flex-1 py-3.5 bg-[var(--color-primary)] text-white rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>Save Entry</>}
              </button>
            </div>
          </div>
        )}

        {/* QR: Success */}
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
                {customerName ? `${entryType === "debit" ? "Credit" : "Payment"} of NPR ${Number(amount).toLocaleString()} for ${customerName}` : `NPR ${Number(amount).toLocaleString()} saved`}
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={handleReset} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium active:scale-[0.98] transition-transform">Scan Another</button>
              <a href="/merchant/logs" className="flex-1 py-3 bg-[var(--color-primary)] text-white rounded-xl font-medium active:scale-[0.98] transition-transform flex items-center justify-center">View Ledger</a>
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
