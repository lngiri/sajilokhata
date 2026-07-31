"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { QRScanner } from "@/components/QRCode";
import { useToast } from "@/components/Toast";
import AmountSuggestions from "@/components/AmountSuggestions";
import BottomNav from "@/components/BottomNav";
import { getCurrentMerchantId } from "@/lib/auth";
import { getMerchantProfile } from "@/app/actions/merchant";
import { saveEntry } from "@/app/actions/entry";
import {
  getMerchantCashBalance,
  getMerchantCustomerBalance,
  getMerchantRecentDescriptions,
  uploadAttachment,
} from "@/app/actions/merchant";
import { compressImage, blobToBase64 } from "@/lib/image";
import { checkCustomerByPhone, addCustomerForMerchant, searchCustomers } from "@/app/actions/customer";

import { savePendingLog, savePendingAttachment } from "@/lib/offline/db";
import { useSearchParams } from "next/navigation";
import { sanitizePhoneForUrl, normalizePhone } from "@/lib/phone";
import DescriptionSuggestions from "@/components/DescriptionSuggestions";
import { getMerchantProducts } from "@/app/actions/products";
import InsufficientCashModal from "@/components/InsufficientCashModal";

type Step = "scan" | "enter" | "confirm" | "success";
type EntryType = "debit" | "credit" | "cash" | "expense" | "cash_in";
type Product = { id: string; name: string; unit: string; default_rate: number; category: string | null };

/** Prefix that identifies a customer identity QR */
const CUSTOMER_QR_PREFIX = "QR Hisab:customer:";

const isImmediateType = (t: EntryType) => t === "cash" || t === "cash_in" || t === "expense";

// ─── Shared field components (manual + QR modes) ────────────────

function ProductPicker({
  products,
  selectedProductId,
  onSelect,
}: {
  products: Product[];
  selectedProductId: string | null;
  onSelect: (id: string | null) => void;
}) {
  if (products.length === 0) return null;
  return (
    <div>
      <label className="text-sm font-medium text-[var(--color-text)]">Product</label>
      <div className="mt-1 flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            selectedProductId === null
              ? "bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] border-[var(--color-primary)]"
              : "bg-[var(--color-surface)] text-gray-600 dark:text-gray-300 border-[var(--color-border)]"
          }`}
        >
          Custom
        </button>
        {products.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              selectedProductId === p.id
                ? "bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] border-[var(--color-primary)]"
                : "bg-[var(--color-surface)] text-gray-600 dark:text-gray-300 border-[var(--color-border)]"
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function AmountField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <input
        type="number"
        min="1"
        step="any"
        placeholder="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus
        className="w-full mt-1 px-4 py-4 bg-white dark:bg-gray-800 rounded-2xl text-2xl sm:text-3xl font-bold text-center border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all dark:text-white"
      />
      <AmountSuggestions onSelect={(v) => onChange(String(v))} />
    </div>
  );
}

function DescriptionField({
  value,
  onChange,
  placeholder,
  descriptions,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  descriptions: string[];
}) {
  return (
    <div>
      <label className="text-sm font-medium text-[var(--color-text)]">Description</label>
      <input
        type="text"
        maxLength={200}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 px-4 py-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all dark:text-white"
      />
      <DescriptionSuggestions
        descriptions={descriptions}
        onSelect={onChange}
      />
    </div>
  );
}

export default function MerchantScanPage() {
  const router = useRouter();
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
  const [entryType, setEntryType] = useState<EntryType>("debit");
  const [saving, setSaving] = useState(false);
  const [merchantId, setMerchantId] = useState<string | null>(null);

  // Manual mode state
  const [searchQuery, setSearchQuery] = useState("");
  const [customerBalance, setCustomerBalance] = useState<number | null>(null);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [customerLookup, setCustomerLookup] = useState<"idle" | "looking" | "found" | "not_found">("idle");
  const [suggestions, setSuggestions] = useState<{ id: string; name: string | null; phone: string; current_balance: number }[]>([]);
  const [searchingSuggestions, setSearchingSuggestions] = useState(false);
  const [nameSearched, setNameSearched] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchQueryRef = useRef("");
  const [addingCustomer, setAddingCustomer] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const [smsError, setSmsError] = useState<string | null>(null);
  const [recentDescriptions, setRecentDescriptions] = useState<string[]>([]);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profileCheckedRef = useRef(false);
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [parsingBill, setParsingBill] = useState(false);

  // Cash-in-hand warning for expense entries
  const [cashBalance, setCashBalance] = useState<number | null>(null);
  const [showInsufficientModal, setShowInsufficientModal] = useState(false);
  const insufficientOverrideRef = useRef(false);

  // Guards: one idempotency key per draft, one save at a time
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());
  const savingRef = useRef(false);

  // Load merchant ID and customer list on mount
  useEffect(() => {
    getCurrentMerchantId().then((id) => {
      setMerchantId(id);
      if (!id) {
        router.replace("/login?redirect=/merchant/scan");
      }
    });
  }, []);

  // Check merchant profile completeness
  useEffect(() => {
    if (profileCheckedRef.current) return;
    if (merchantId) {
      getMerchantProfile(merchantId, "name, address, business_type").then((profile: any) => {
        profileCheckedRef.current = true;
        if (profile && (!profile.name || !profile.address || !profile.business_type)) {
          addToast("Please complete your business profile first", "warning");
          router.replace("/merchant/dashboard");
        }
      }).catch(() => { profileCheckedRef.current = true; });
    }
  }, [merchantId]);

  // Read the type query param to set the correct entry type
  useEffect(() => {
    if (isManual && step === "scan") {
      setStep("enter");
      const typeParam = searchParams?.get("type");
      if (typeParam === "expense") {
        setEntryType("expense");
      } else if (typeParam === "cash_in") {
        setEntryType("cash_in");
      } else if (typeParam === "cash") {
        setEntryType("cash");
      } else {
        setEntryType("cash");
      }
    }
  }, [isManual, step, searchParams]);

  // Load recent descriptions + products for BOTH manual and QR modes
  useEffect(() => {
    if (merchantId) {
      getMerchantRecentDescriptions(merchantId).then(setRecentDescriptions).catch(() => {});
      getMerchantProducts(merchantId).then(setProducts).catch(() => {});
    }
  }, [merchantId]);

  // Fetch current cash in hand when reviewing an expense, and warn if it is insufficient
  useEffect(() => {
    if (step !== "confirm" || entryType !== "expense") return;
    let cancelled = false;
    (async () => {
      try {
        const mId = await getCurrentMerchantId();
        if (!mId || cancelled) return;
        const bal = await getMerchantCashBalance(mId);
        if (cancelled) return;
        setCashBalance(bal);
        if (Number(amount) > bal) {
          setShowInsufficientModal(true);
        }
      } catch {
        if (!cancelled) setCashBalance(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, entryType, amount]);

  // Revoke old attachment previews (also runs on unmount) to avoid blob URL leaks
  useEffect(() => {
    return () => {
      if (attachmentPreview) URL.revokeObjectURL(attachmentPreview);
    };
  }, [attachmentPreview]);

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setSearchingSuggestions(false);
    setNameSearched(false);
  }, []);

  const handleTypeChange = useCallback((type: EntryType) => {
    setEntryType(type);
    clearSuggestions();
    if (isImmediateType(type)) {
      setCustomerId(null);
      setCustomerPhone("");
      setCustomerName(null);
      setCustomerLookup("idle");
      setCustomerBalance(null);
      setSmsSent(false);
      setSmsError(null);
    }
  }, [clearSuggestions]);

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
    // In QR scan mode customerId is null (server resolves via phone)
    // Expense, cash and cash_in don't require a customer
    const isImmediate = isImmediateType(entryType);
    if (!isImmediate && !customerPhone) {
      addToast("Please select or enter a valid customer.", "error");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      addToast("Please enter a valid amount.", "error");
      return;
    }
    insufficientOverrideRef.current = false;
    setCashBalance(null);
    setStep("confirm");
  };

  const selectCustomer = (c: { id: string; name: string | null; phone: string }) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    setCustomerId(c.id);
    setCustomerPhone(c.phone);
    setCustomerName(c.name);
    setCustomerLookup("found");
    setSuggestions([]);
    setSearchingSuggestions(false);
    setSearchQuery(c.name || c.phone);
    if (merchantId) {
      getMerchantCustomerBalance(merchantId, c.id).then(({ balance }) => {
        setCustomerBalance(balance);
      }).catch(() => setCustomerBalance(null));
    }
  };

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  const clearAttachment = useCallback(() => {
    setAttachmentFile(null);
    setAttachmentPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleConfirm = async () => {
    if (savingRef.current) return;
    const isCash = entryType === "cash";
    const isExpense = entryType === "expense";
    const isCashIn = entryType === "cash_in";

    // Warn when an expense/purchase exceeds the cash currently in hand
    if (isExpense && cashBalance !== null && Number(amount) > cashBalance && !insufficientOverrideRef.current) {
      setShowInsufficientModal(true);
      return;
    }

    savingRef.current = true;
    setSaving(true);

    try {
      const mId = await getCurrentMerchantId();
      if (!mId) {
        addToast("Not logged in", "error");
        return;
      }

      const isImmediate = isCash || isCashIn || isExpense;
      const cId = customerId; // may be null for cash/expense or new customers
      const cPhone = customerPhone || null;
      const cName = customerName;

      if (isManual) {
        if (navigator.onLine) {
          // Online: upload attachment FIRST, then save entry via unified server action
          let attachmentUrl: string | null = null;

          if (attachmentFile) {
            setAttachmentUploading(true);
            try {
              const compressed = await compressImage(attachmentFile, 200);
              attachmentUrl = await uploadAttachment(mId, crypto.randomUUID(), compressed);
            } catch (err) {
              console.error("[Entry] Attachment upload failed:", err);
              addToast("Photo upload failed. Entry saved without photo.", "warning");
            } finally {
              setAttachmentUploading(false);
            }
          }

          const result = await saveEntry({
            merchant_id: mId,
            customer_id: cId ?? null,
            customer_phone: cPhone,
            customer_name: cName,
            amount: Number(amount),
            type: entryType,
            description: description || null,
            quantity: quantity ? Number(quantity) : null,
            unit: (unit || null) as any,
            attachment_url: attachmentUrl,
            idempotency_key: idempotencyKeyRef.current,
            items: selectedProductId && quantity && unit ? [{
              product_id: selectedProductId,
              product_name: description || "Item",
              quantity: Number(quantity),
              unit: unit,
              unit_price: Number(amount) / Number(quantity || 1),
            }] : undefined,
          });

          if (!result.success) {
            console.error("[Entry] saveEntry failed:", result.error, "full:", result.fullError);
            throw new Error(result.error || "Failed to save entry");
          }

          if (result.entry?.verification_token) {
            setVerificationToken(result.entry.verification_token);
          }
        } else {
          // Offline: save as pending log + pending attachment
          const offlineLogId = crypto.randomUUID();
          let attachmentUrl: string | null = null;

          if (attachmentFile) {
            setAttachmentUploading(true);
            try {
              const compressed = await compressImage(attachmentFile, 200);
              const base64 = await blobToBase64(compressed);
              await savePendingAttachment({
                id: crypto.randomUUID(),
                logId: offlineLogId,
                merchantId: mId,
                data: base64,
              });
            } catch (err) {
              console.error("[Entry] Offline attachment save failed:", err);
            } finally {
              setAttachmentUploading(false);
            }
          }

          // Save to IndexedDB for later sync (phone preserved so sync can resolve the customer)
          await savePendingLog({
            id: offlineLogId,
            merchant_id: mId,
            customer_id: cId ?? null,
            customerPhone: cPhone || "",
            type: entryType,
            amount: Number(amount),
            description: description || null,
            quantity: quantity ? Number(quantity) : null,
            unit: (unit || null) as any,
            attachment_url: attachmentUrl ?? null,
            status: isImmediate ? "approved" : "awaiting_confirmation",
            items: selectedProductId && quantity && unit ? [{
              productId: selectedProductId,
              productName: description || "Item",
              quantity: Number(quantity),
              unit: unit,
              unitPrice: Number(amount) / Number(quantity || 1),
            }] : undefined,
          });
        }
      } else {
        // QR scan mode — use server action (always online)
        const result = await saveEntry({
          merchant_id: mId,
          customer_id: null,
          customer_phone: cPhone,
          customer_name: cName,
          amount: Number(amount),
          description: description || null,
          type: entryType,
          idempotency_key: idempotencyKeyRef.current,
          items: selectedProductId && quantity && unit ? [{
            product_id: selectedProductId,
            product_name: description || "Item",
            quantity: Number(quantity),
            unit: unit,
            unit_price: Number(amount) / Number(quantity || 1),
          }] : undefined,
        });

        if (!result.success) {
          throw new Error(result.error || "Failed to save entry");
        }
      }

      setStep("success");
      const wasOffline = !navigator.onLine;
      addToast(
        wasOffline
          ? "Entry saved offline. Will sync when internet returns."
          : isExpense
            ? "Expense recorded!"
            : isCashIn
            ? "Cash In recorded!"
            : isCash
            ? "Cash sale recorded!"
            : "Entry saved! Customer notified.",
        "success"
      );
    } catch (err) {
      console.error("Failed to save entry:", err);
      addToast("Failed to save. Please try again.", "error");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const handleInsufficientEdit = () => {
    setShowInsufficientModal(false);
    setStep("enter");
  };

  const handleRecordAnyway = () => {
    insufficientOverrideRef.current = true;
    setShowInsufficientModal(false);
    handleConfirm();
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
    setCustomerLookup("idle");
    setSmsSent(false);
    setSmsError(null);
    setQuantity("");
    setUnit("");
    setSelectedProductId(null);
    clearAttachment();
    insufficientOverrideRef.current = false;
    idempotencyKeyRef.current = crypto.randomUUID();
  };

  const handleAIParseBill = async (file: File) => {
    setParsingBill(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      await new Promise((resolve) => { reader.onload = resolve; });
      const base64 = reader.result as string;
      const res = await fetch("/api/ai/parse-bill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, merchantId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        addToast(data?.error || "Failed to parse bill", "error");
        return;
      }
      if (data && typeof data.amount === "number" && data.amount > 0) {
        setAmount(String(data.amount));
      }
      const summary = data?.items_summary;
      if (summary && summary !== "Could not read bill" && summary !== "AI service error" && summary !== "Parse error") {
        setDescription(summary);
      }
      addToast("Bill parsed successfully!", "success");
    } catch {
      addToast("Failed to parse bill", "error");
    } finally {
      setParsingBill(false);
    }
  };

  // ─── Hydration guard: return matching skeleton until mounted ────
  if (!isMounted) {
    return <div className="min-h-screen dark:bg-gray-800/50" />;
  }

  // ─── Manual mode: short-circuit, no camera ──────────────────────
  if (isManual) {
    return (
      <div className="pb-20">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-[var(--color-bg)]/80 backdrop-blur-md border-b border-[var(--color-border)]">
          <div className="flex items-center px-4 py-3">
            <a href="/merchant/dashboard" aria-label="Back to dashboard" className="mr-3 p-1 active:scale-95 transition-transform">
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
              {/* Customer search (name or phone) with auto-detect */}
              <div>
                <label className="text-sm font-medium text-[var(--color-text)]">
                  {(entryType === "cash" || entryType === "cash_in" || entryType === "expense") ? (entryType === "expense" ? "Supplier Name or Phone (Optional)" : "Customer Name or Phone (Optional)") : "Customer Name or Phone"}
                </label>
                <div className="relative mt-1">
                  <input
                    type="text"
                    placeholder="Search name or phone (98XXXXXXXX)"
                    value={searchQuery}
                    onChange={(e) => {
                      const val = e.target.value.slice(0, 60);
                      setSearchQuery(val);
                      searchQueryRef.current = val;
                      setCustomerLookup("idle");
                      setSmsSent(false);
                      setNameSearched(false);
                      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                      setSuggestions([]);

                      const isImmediate = isImmediateType(entryType);
                      const isNumeric = /^\d+$/.test(val);
                      const isFullPhone = isNumeric && val.length === 10;

                      // Full 10-digit phone → exact lookup (existing flow)
                      if (isFullPhone) {
                        setCustomerLookup("looking");
                        setSearchingSuggestions(true);
                        (async () => {
                          try {
                            const result = await checkCustomerByPhone(val);
                            if (searchQueryRef.current !== val) return;
                            if (result.exists && result.customer) {
                              selectCustomer(result.customer);
                            } else {
                              setCustomerId(null);
                              setCustomerPhone(val);
                              setCustomerName(null);
                              setCustomerLookup("not_found");
                              setCustomerBalance(null);
                            }
                          } catch {
                            if (searchQueryRef.current === val) setCustomerLookup("idle");
                          } finally {
                            if (searchQueryRef.current === val) setSearchingSuggestions(false);
                          }
                        })();
                        return;
                      }

                      // Partial phone or name → debounced suggestion search
                      const trimmed = val.trim();
                      if (trimmed.length < 2) {
                        setCustomerId(null);
                        setCustomerName(null);
                        setCustomerBalance(null);
                        setCustomerPhone(!isImmediate && isNumeric ? val : "");
                        setSearchingSuggestions(false);
                        return;
                      }

                      setSearchingSuggestions(true);
                      searchDebounceRef.current = setTimeout(async () => {
                        try {
                          const matches = await searchCustomers(merchantId || "", trimmed);
                          if (searchQueryRef.current !== val) return;
                          setSuggestions(matches);
                          setNameSearched(true);
                          setSearchingSuggestions(false);
                          // Auto-select when an exact 10-digit phone matches a single customer
                          if (matches.length === 1 && isNumeric && normalizePhone(matches[0].phone) === normalizePhone(val)) {
                            selectCustomer(matches[0]);
                          } else if (!isImmediate && isNumeric) {
                            // Keep the typed phone so Continue still works without an exact match
                            setCustomerPhone(val);
                          }
                        } catch {
                          if (searchQueryRef.current === val) setSearchingSuggestions(false);
                        }
                      }, 300);
                    }}
                    className="w-full px-4 py-3 bg-white rounded-xl border border-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all text-left text-base dark:bg-gray-800 dark:border-gray-700 dark:text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:dark:bg-gray-800/50"
                  />
                  {searchingSuggestions && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                  )}
                </div>

                {/* Name / partial-phone suggestions (critical/due customers first) */}
                {suggestions.length > 0 && (
                  <div className="mt-2 bg-white dark:bg-gray-800 rounded-xl border border-[var(--color-border)] shadow-lg overflow-hidden">
                    {suggestions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => selectCustomer(s)}
                        className="w-full flex items-center justify-between gap-2 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors text-left border-b border-gray-50 dark:border-gray-700 last:border-b-0"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-[var(--color-text)] truncate">{s.name || "Unnamed customer"}</p>
                          <p className="text-xs text-[var(--color-text-muted)]">{s.phone}</p>
                        </div>
                        {s.current_balance > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 flex-shrink-0">
                            Due Rs. {s.current_balance.toLocaleString()}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 flex-shrink-0">
                            No Due
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {nameSearched && suggestions.length === 0 && !searchingSuggestions && (
                  <div className="mt-2 px-3 py-2 bg-gray-100 dark:bg-gray-700/60 rounded-lg text-sm text-[var(--color-text-muted)]">
                    No customers found matching &ldquo;{searchQuery}&rdquo;. Try a name or full phone number.
                  </div>
                )}

                {/* Lookup result */}
                {entryType !== "cash" && entryType !== "cash_in" && entryType !== "expense" && customerLookup === "found" && (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-2 px-3 py-2 bg-green-100 dark:bg-green-900/40 rounded-lg text-sm font-medium text-green-700 dark:text-green-300">
                      <svg className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Already registered ✅{customerName ? ` as ${customerName}` : ""}</span>
                    </div>
                    {customerBalance !== null && (
                      <div className={`px-3 py-2 rounded-lg text-sm font-medium ${customerBalance > 0 ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300" : "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"}`}>
                        {customerBalance > 0 ? `Current Due: Rs. ${customerBalance.toLocaleString()}` : "No outstanding balance"}
                      </div>
                    )}
                  </div>
                )}

                {entryType !== "cash" && entryType !== "cash_in" && entryType !== "expense" && customerLookup === "not_found" && (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg text-sm font-medium text-amber-700 dark:text-amber-300">
                      <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                      <span>Not registered yet 📱</span>
                    </div>
                    {!smsSent ? (
                      <button
                        type="button"
                        disabled={addingCustomer}
                        onClick={async () => {
                          setAddingCustomer(true);
                          try {
                            if (!merchantId) { addToast("Not logged in", "error"); return; }
                            const result = await addCustomerForMerchant(merchantId, searchQuery);
                            if (!result.success || !result.customer) {
                              addToast(result.error || "Failed to add customer", "error");
                              return;
                            }
                            setCustomerId(result.customer.id);
                            setCustomerPhone(result.customer.phone);
                            setCustomerName(result.customer.name || "");
                            setSmsSent(result.smsSent ?? false);
                            setSmsError(result.smsError || null);
                            setCustomerLookup("found");
                            if (result.smsSent) {
                              addToast("Invitation sent successfully.", "success");
                            } else {
                              addToast(`Invitation created but SMS delivery failed: ${result.smsError || "Unknown error"}`, "error");
                            }
                            if (merchantId) {
                              try {
                                const { balance } = await getMerchantCustomerBalance(merchantId, result.customer.id);
                                setCustomerBalance(balance);
                              } catch { setCustomerBalance(null); }
                            }
                          } catch {
                            addToast("Failed to add customer", "error");
                          } finally {
                            setAddingCustomer(false);
                          }
                        }}
                        className="w-full py-2.5 bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] rounded-xl text-sm font-medium active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {addingCustomer ? (
                          <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Adding...</>
                        ) : (
                          <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg> Send Invitation</>
                        )}
                      </button>
                    ) : (
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${smsSent ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300" : "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"}`}>
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          {smsSent ? (
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                          )}
                        </svg>
                        <span>{smsSent ? "Invitation sent successfully." : `SMS failed: ${smsError || "Delivery error"}`}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-[var(--color-surface)] rounded-2xl p-4 shadow-sm border border-[var(--color-border)]">
                <p className="text-sm font-medium text-[var(--color-text)] mb-3">Transaction Type</p>
                <div className="flex gap-2">
                  <button onClick={() => handleTypeChange("debit")}
                    className={`flex-1 py-2.5 rounded-xl text-[11px] sm:text-sm font-semibold transition-all ${entryType === "debit" ? "bg-red-600 text-white shadow-sm" : "bg-gray-100 dark:bg-gray-800 text-[var(--color-text-muted)]"}`}>
                    Credit Given
                  </button>
                  <button onClick={() => handleTypeChange("credit")}
                    className={`flex-1 py-2.5 rounded-xl text-[11px] sm:text-sm font-semibold transition-all ${entryType === "credit" ? "bg-green-600 text-white shadow-sm" : "bg-gray-100 dark:bg-gray-800 text-[var(--color-text-muted)]"}`}>
                    Amount Received
                  </button>
                  <div className="flex-1 flex rounded-xl overflow-hidden border border-[var(--color-border)]">
                    <button onClick={() => handleTypeChange("cash")}
                      className={`flex-1 py-2.5 text-[11px] sm:text-sm font-semibold transition-all ${entryType === "cash" ? "bg-blue-600 text-white shadow-sm" : "bg-gray-100 dark:bg-gray-800 text-[var(--color-text-muted)]"}`}>
                      Cash Sale
                    </button>
                    <button onClick={() => handleTypeChange("cash_in")}
                      className={`flex-1 py-2.5 text-[11px] sm:text-sm font-semibold transition-all border-l border-[var(--color-border)] ${entryType === "cash_in" ? "bg-teal-600 text-white shadow-sm" : "bg-gray-100 dark:bg-gray-800 text-[var(--color-text-muted)]"}`}>
                      Cash In
                    </button>
                  </div>
                  <button onClick={() => handleTypeChange("expense")}
                    className={`flex-1 py-2.5 rounded-xl text-[11px] sm:text-sm font-semibold transition-all ${entryType === "expense" ? "bg-orange-600 text-white shadow-sm" : "bg-gray-100 dark:bg-gray-800 text-[var(--color-text-muted)]"}`}>
                    Cash Out
                  </button>
                </div>
              </div>

              <div className="bg-[var(--color-surface)] rounded-2xl p-5 shadow-sm border border-[var(--color-border)] space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-[var(--color-text)]">Amount</label>
                  <button type="button" onClick={() => document.getElementById("ai-bill-input")?.click()} disabled={parsingBill}
                    className="text-xs text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300 transition disabled:opacity-50">
                    {parsingBill ? "Parsing…" : "Scan Bill with AI"}
                  </button>
                </div>
                <input type="file" id="ai-bill-input" accept="image/*" className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    await handleAIParseBill(file);
                  }} />

                <ProductPicker
                  products={products}
                  selectedProductId={selectedProductId}
                  onSelect={(id) => {
                    setSelectedProductId(id);
                    if (id) {
                      const p = products.find((x) => x.id === id);
                      if (p) {
                        setDescription(p.name);
                        setAmount(String(p.default_rate));
                        setQuantity("1");
                        setUnit(p.unit);
                      }
                    }
                  }}
                />

                <AmountField value={amount} onChange={setAmount} />
                <DescriptionField
                  value={description}
                  onChange={setDescription}
                  descriptions={recentDescriptions}
                  placeholder={entryType === "expense" ? "e.g. Transport, Rent, Supplier payment" : entryType === "debit" ? "e.g. Rice 10kg, Milk 2L" : entryType === "cash" ? "e.g. Grocery items" : entryType === "cash_in" ? "e.g. Money from home, bank deposit" : "e.g. Payment for last week"}
                />

                {/* Quantity / Unit */}
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-[var(--color-text)]">Quantity</label>
                    <input type="number" min="0" step="any" placeholder="0" value={quantity} onChange={(e) => setQuantity(e.target.value)}
                      className="w-full mt-1 px-4 py-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all text-center dark:text-white" />
                  </div>
                  <div className="flex-1">
                    <label className="text-sm font-medium text-[var(--color-text)]">Unit</label>
                    <select value={unit} onChange={(e) => setUnit(e.target.value)}
                      className="w-full mt-1 px-4 py-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all text-sm appearance-none dark:text-white">
                      <option value="">—</option>
                      <option value="liter">Liter</option>
                      <option value="kg">Kg</option>
                      <option value="piece">Piece</option>
                      <option value="jar">Jar</option>
                      <option value="npr">NPR</option>
                    </select>
                  </div>
                </div>

                {/* Attach Bill / Photo */}
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setAttachmentFile(file);
                      setAttachmentPreview(URL.createObjectURL(file));
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)] active:scale-[0.98] transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                      </svg>
                      {attachmentFile ? "Change Photo" : "Attach Bill / Photo"}
                    </button>
                    {attachmentPreview && (
                      <div className="relative">
                        <img
                          src={attachmentPreview}
                          alt="Receipt preview"
                          className="w-10 h-10 rounded-lg object-cover border border-[var(--color-border)]"
                        />
                        <button
                          type="button"
                          onClick={clearAttachment}
                          className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}
                    {attachmentUploading && (
                      <div className="w-5 h-5 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={handleReset} className="flex-1 py-3.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl font-medium active:scale-[0.98] transition-transform">Cancel</button>
                <button onClick={handleEnterNext} disabled={!amount || Number(amount) <= 0}
                  className="flex-1 py-3.5 bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50">Continue</button>
              </div>
            </div>
          )}

          {/* Manual: Confirm */}
          {step === "confirm" && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-[var(--color-surface)] rounded-2xl p-5 shadow-sm border border-[var(--color-border)] space-y-4">
                <div className="text-center pb-2 border-b border-[var(--color-border)]">
                  <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)]">Review Entry Details</p>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Customer</p>
                    <p className="font-medium text-[var(--color-text)]">
                      {(entryType === "cash" || entryType === "cash_in" || entryType === "expense") && !customerName && !customerPhone
                        ? (entryType === "expense" ? "N/A (Business Expense)" : entryType === "cash_in" ? "N/A (Cash In)" : "Walk-in Customer")
                        : (customerName || customerPhone || "—")}
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Amount</p>
                      <p className={`text-2xl font-bold ${entryType === "debit" ? "text-red-600 dark:text-red-400" : entryType === "expense" ? "text-orange-600 dark:text-orange-400" : entryType === "cash" ? "text-blue-600 dark:text-blue-400" : entryType === "cash_in" ? "text-teal-600 dark:text-teal-400" : "text-green-600 dark:text-green-400"}`}>Rs. {Number(amount).toLocaleString()}</p>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Type</p>
                      <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${entryType === "debit" ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300" : entryType === "expense" ? "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300" : entryType === "cash" ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" : entryType === "cash_in" ? "bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300" : "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"}`}>
                        {entryType === "debit" ? "Credit Given" : entryType === "expense" ? "Cash Out" : entryType === "cash" ? "Cash Sale" : entryType === "cash_in" ? "Cash In" : "Amount Received"}
                      </span>
                    </div>
                  </div>
                  {description && (
                    <div>
                      <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Description</p>
                      <p className="text-sm text-[var(--color-text)]">{description}</p>
                    </div>
                  )}
                  {quantity && unit && (
                    <div>
                      <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Quantity</p>
                      <p className="text-sm font-medium text-[var(--color-text)]">{quantity} {unit}</p>
                    </div>
                  )}
                  {entryType === "expense" ? (
                    <div className={`rounded-xl p-3 flex items-start gap-2 ${cashBalance !== null && Number(amount) > cashBalance ? "bg-red-100 dark:bg-red-900/40" : "bg-orange-100 dark:bg-orange-900/40"}`}>
                      <svg className={`w-4 h-4 mt-0.5 flex-shrink-0 ${cashBalance !== null && Number(amount) > cashBalance ? "text-red-600 dark:text-red-400" : "text-orange-600 dark:text-orange-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                      {cashBalance !== null && Number(amount) > cashBalance ? (
                        <p className="text-xs text-red-800 dark:text-red-300">
                          <span className="font-semibold">Insufficient Cash in Hand!</span> Current balance: Rs. {cashBalance.toLocaleString()}. This expense of Rs. {Number(amount).toLocaleString()} exceeds it by Rs. {(Number(amount) - cashBalance).toLocaleString()}.
                        </p>
                      ) : (
                        <p className="text-xs text-orange-800 dark:text-orange-300">
                          Expense will be recorded immediately. Current Cash in Hand: Rs. {cashBalance !== null ? cashBalance.toLocaleString() : "—"}. This amount will be deducted from it.
                        </p>
                      )}
                    </div>
                  ) : entryType === "cash" ? (
                    <div className="bg-blue-100 dark:bg-blue-900/40 rounded-xl p-3 flex items-start gap-2">
                      <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                      <p className="text-xs text-blue-800 dark:text-blue-300">Cash sale will be recorded immediately. No customer confirmation needed.</p>
                    </div>
                  ) : entryType === "cash_in" ? (
                    <div className="bg-teal-100 dark:bg-teal-900/40 rounded-xl p-3 flex items-start gap-2">
                      <svg className="w-4 h-4 text-teal-600 dark:text-teal-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                      <p className="text-xs text-teal-800 dark:text-teal-300">Cash In will be recorded immediately. This amount will be <span className="font-semibold">added</span> to Cash in Hand. No customer confirmation needed.</p>
                    </div>
                  ) : (
                    <div className="bg-amber-100 dark:bg-amber-900/40 rounded-xl p-3 flex items-start gap-2">
                      <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                      <p className="text-xs text-amber-800 dark:text-amber-300">This entry will appear as "Unverified" on the customer's side. They must confirm it to mark it approved.</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep("enter")} disabled={saving} className="flex-1 py-3.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl font-medium active:scale-[0.98] transition-transform disabled:opacity-50">Edit</button>
                <button onClick={handleConfirm} disabled={saving} className="flex-1 py-3.5 bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <div className="w-5 h-5 border-2 border-[var(--color-bg)] border-t-transparent rounded-full animate-spin" /> : <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>Save Entry</>}
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
                <h2 className="text-xl font-bold text-[var(--color-text)] mb-1">Entry Saved! 🎉</h2>
                <p className="text-sm text-[var(--color-text-muted)]">
                  {entryType === "expense"
                    ? `Expense of Rs. ${Number(amount).toLocaleString()} recorded`
                    : entryType === "cash_in"
                    ? `Rs. ${Number(amount).toLocaleString()} added to Cash in Hand`
                    : entryType === "cash"
                    ? `Cash Sale of Rs. ${Number(amount).toLocaleString()}${customerName ? ` from ${customerName}` : ""}`
                    : `${customerName ? `${entryType === "debit" ? "Credit" : "Payment"} of Rs. ${Number(amount).toLocaleString()} for ${customerName}` : `Rs. ${Number(amount).toLocaleString()} saved`}`}
                </p>
                {entryType === "expense" ? (
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">Expense recorded and deducted from cash in hand</p>
                ) : entryType === "cash_in" ? (
                  <p className="text-xs text-teal-600 dark:text-teal-400 mt-2">Cash In recorded and added to cash in hand</p>
                ) : entryType === "cash" ? (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">Cash sale recorded and approved</p>
                ) : (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">Waiting for customer confirmation</p>
                )}
                {verificationToken && customerPhone && !isImmediateType(entryType) && (
                  <>
                    <div className="flex gap-2 mt-3">
                      <a
                        href={`https://wa.me/${sanitizePhoneForUrl(customerPhone)}?text=${encodeURIComponent(
                          (() => {
                            const baseUrl = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_SITE_URL || '');
                            const shareLink = `${baseUrl}/verify?token=${verificationToken}`;
                            return `Dear customer, Rs. ${Number(amount).toLocaleString()} has been added to your account. Please verify using this link: ${shareLink}`;
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
                          const baseUrl = typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_SITE_URL || '');
                          const link = `${baseUrl}/verify?token=${verificationToken}`;
                          try {
                            await navigator.clipboard.writeText(link);
                            addToast("Link copied!", "success");
                          } catch {
                            addToast("Failed to copy", "error");
                          }
                        }}
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-xl text-sm font-medium active:scale-[0.98] transition-transform hover:bg-gray-200 dark:hover:bg-gray-700"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                        </svg>
                        Copy Link
                      </button>
                    </div>
                  </>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={handleReset} className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl font-medium active:scale-[0.98] transition-transform">New Entry</button>
                <a href="/merchant/logs" className="flex-1 py-3 bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] rounded-xl font-medium active:scale-[0.98] transition-transform flex items-center justify-center">View Ledger</a>
              </div>
            </div>
          )}
        </div>

        <InsufficientCashModal
          open={showInsufficientModal}
          cashBalance={cashBalance ?? 0}
          amount={Number(amount)}
          onEdit={handleInsufficientEdit}
          onRecordAnyway={handleRecordAnyway}
        />
        <BottomNav />
      </div>
    );
  }

  // ─── QR scan mode ──────────────────────────────────────────────
  return (
    <div className="pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[var(--color-bg)]/80 backdrop-blur-md border-b border-[var(--color-border)]">
        <div className="flex items-center px-4 py-3">
          <a href="/merchant/dashboard" aria-label="Back to dashboard" className="mr-3 p-1 active:scale-95 transition-transform">
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
            <div className="bg-[var(--color-surface)] rounded-2xl p-4 shadow-sm border border-[var(--color-border)]">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-[var(--color-text-muted)]">Customer Phone</p>
                  <p className="font-mono font-medium text-[var(--color-text)]">{customerPhone}</p>
                </div>
              </div>
            </div>

            <div className="bg-[var(--color-surface)] rounded-2xl p-5 shadow-sm border border-[var(--color-border)] space-y-4">
              {/* Transaction type — scan mode supports credit and payment */}
              <div>
                <p className="text-sm font-medium text-[var(--color-text)] mb-2">Transaction Type</p>
                <div className="flex gap-2">
                  <button onClick={() => handleTypeChange("debit")}
                    className={`flex-1 py-2.5 rounded-xl text-[11px] sm:text-sm font-semibold transition-all ${entryType === "debit" ? "bg-red-600 text-white shadow-sm" : "bg-gray-100 dark:bg-gray-800 text-[var(--color-text-muted)]"}`}>
                    Credit Given
                  </button>
                  <button onClick={() => handleTypeChange("credit")}
                    className={`flex-1 py-2.5 rounded-xl text-[11px] sm:text-sm font-semibold transition-all ${entryType === "credit" ? "bg-green-600 text-white shadow-sm" : "bg-gray-100 dark:bg-gray-800 text-[var(--color-text-muted)]"}`}>
                    Amount Received
                  </button>
                </div>
              </div>

              <ProductPicker
                products={products}
                selectedProductId={selectedProductId}
                onSelect={(id) => {
                  setSelectedProductId(id);
                  if (id) {
                    const p = products.find((x) => x.id === id);
                    if (p) {
                      setDescription(p.name);
                      setAmount(String(p.default_rate));
                      setQuantity("1");
                      setUnit(p.unit);
                    }
                  }
                }}
              />
              <AmountField value={amount} onChange={setAmount} />
              <DescriptionField
                value={description}
                onChange={setDescription}
                descriptions={recentDescriptions}
                placeholder={entryType === "debit" ? "e.g. Rice 10kg, Milk 2L" : "e.g. Payment for last week"}
              />
            </div>

            <div className="flex gap-3">
              <button onClick={handleReset} className="flex-1 py-3.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl font-medium active:scale-[0.98] transition-transform">Cancel</button>
              <button onClick={handleEnterNext} disabled={!amount || Number(amount) <= 0}
                className="flex-1 py-3.5 bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50">Continue</button>
            </div>
          </div>
        )}

        {/* QR: Confirm */}
        {step === "confirm" && (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-[var(--color-surface)] rounded-2xl p-5 shadow-sm border border-[var(--color-border)] space-y-4">
              <div className="text-center pb-2 border-b border-[var(--color-border)]">
                <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                    <p className={`text-2xl font-bold ${entryType === "debit" ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>Rs. {Number(amount).toLocaleString()}</p>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Type</p>
                    <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${entryType === "debit" ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300" : "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"}`}>
                      {entryType === "debit" ? "Credit Given" : "Amount Received"}
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
              <button onClick={() => setStep("enter")} disabled={saving} className="flex-1 py-3.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl font-medium active:scale-[0.98] transition-transform disabled:opacity-50">Edit</button>
              <button onClick={handleConfirm} disabled={saving} className="flex-1 py-3.5 bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2">
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
              <h2 className="text-xl font-bold text-[var(--color-text)] mb-1">Entry Saved! 🎉</h2>
              <p className="text-sm text-[var(--color-text-muted)]">
                {customerName ? `${entryType === "debit" ? "Credit" : "Payment"} of Rs. ${Number(amount).toLocaleString()} for ${customerName}` : `Rs. ${Number(amount).toLocaleString()} saved`}
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={handleReset} className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl font-medium active:scale-[0.98] transition-transform">Scan Another</button>
              <a href="/merchant/logs" className="flex-1 py-3 bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] rounded-xl font-medium active:scale-[0.98] transition-transform flex items-center justify-center">View Ledger</a>
            </div>
          </div>
        )}
      </div>

      <InsufficientCashModal
        open={showInsufficientModal}
        cashBalance={cashBalance ?? 0}
        amount={Number(amount)}
        onEdit={handleInsufficientEdit}
        onRecordAnyway={handleRecordAnyway}
      />
      <BottomNav />
    </div>
  );
}
