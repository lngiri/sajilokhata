"use client";

import { useState, useEffect, useRef } from "react";
import BottomNav from "@/components/BottomNav";
import { QRDisplay } from "@/components/QRCode";
import { useToast } from "@/components/Toast";
import {
  getCurrentMerchantId,
  getCurrentUserPhone,
  signOut,
} from "@/lib/auth";
import { updateMerchantProfile } from "@/lib/actions";
import {
  getMerchantProfile,
  getMerchantCreditLogs,
  getMerchantPaymentMethods,
  upsertMerchantPaymentMethod,
  getMerchantReminderSettings,
  updateMerchantReminderSettings,
  togglePaymentOption,
} from "@/app/actions/merchant";
import { changePin } from "@/app/actions/pin";
import { getMerchantSmsBalance } from "@/app/actions/sms-billing";
import { isFabHidden, setFabHidden } from "@/lib/ui/fabVisibility";
import { getMerchantInvitations, resendInvitation, cancelInvitation } from "@/app/actions/merchant";
import type { InvitationRecord } from "@/app/actions/merchant";

type TabKey = "shop" | "payments" | "reminders" | "account";
type MethodStatus = "idle" | "editing" | "saving" | "saved" | "error";

const DEFAULT_METHOD = {
  label: null as string | null,
  qr_url: null as string | null,
  account_holder: null as string | null,
  account_number: null as string | null,
  bank_name: null as string | null,
  is_active: false,
  sort_order: 0,
};

export default function SettingsPage() {
  const { addToast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Tabs ──
  const [activeTab, setActiveTab] = useState<TabKey>("shop");

  // Merchant profile state
  const [loading, setLoading] = useState(true);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [merchantName, setMerchantName] = useState("");
  const [businessType, setBusinessType] = useState("kirana");
  const [address, setAddress] = useState("");
  const [initialMerchantName, setInitialMerchantName] = useState("");
  const [initialBusinessType, setInitialBusinessType] = useState("kirana");
  const [initialAddress, setInitialAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [authPhone, setAuthPhone] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  // Payment methods state
  const [paymentMethods, setPaymentMethods] = useState<Record<string, {
    method_type: string;
    label: string | null;
    qr_url: string | null;
    account_holder: string | null;
    account_number: string | null;
    bank_name: string | null;
    is_active: boolean;
    sort_order: number;
  }>>({});
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(true);
  const [expandedMethod, setExpandedMethod] = useState<string | null>(null);
  const [uploadingQrFor, setUploadingQrFor] = useState<string | null>(null);
  const [savingPaymentMethod, setSavingPaymentMethod] = useState<string | null>(null);
  const [paymentEnabled, setPaymentEnabled] = useState(true);
  const [togglingPaymentOption, setTogglingPaymentOption] = useState(false);
  const [methodStatus, setMethodStatus] = useState<Record<string, MethodStatus>>({});
  const methodDebounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Reminder settings state
  const [reminderSettings, setReminderSettings] = useState<{
    auto_reminder_enabled: boolean;
    reminder_message_template: string;
    reminder_day_of_month: number;
  }>({
    auto_reminder_enabled: false,
    reminder_message_template: "Dear {customer}, pay Rs. {balance} to {shop}.",
    reminder_day_of_month: 1,
  });
  const [reminderSettingsLoading, setReminderSettingsLoading] = useState(true);
  const [reminderStatus, setReminderStatus] = useState<"idle" | "saving" | "saved">("idle");
  const reminderDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const PAYMENT_TYPES = [
    { key: "fonepay", label: "Fonepay QR", icon: "🏦", hasQr: true },
    { key: "esewa", label: "E-Sewa", icon: "💳", hasQr: true },
    { key: "khalti", label: "Khalti", icon: "💰", hasQr: true },
    { key: "nepalpay", label: "NepalPay", icon: "🏧", hasQr: true },
    { key: "bank_deposit", label: "Bank Deposit", icon: "🏛️", hasQr: false },
    { key: "cash", label: "Cash", icon: "💵", hasQr: false },
  ] as const;

  function canToggleMethod(methodType: string, method: Record<string, any> | undefined): boolean {
    if (!method) return false;
    if (methodType === "bank_deposit") {
      return !!(method.account_holder && method.account_number);
    }
    if (["fonepay", "esewa", "khalti", "nepalpay"].includes(methodType)) {
      return !!method.qr_url;
    }
    // Cash — always toggleable
    return true;
  }

  const resizeImage = (file: File, maxDim: number): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
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
      img.onerror = () => reject(new Error("Image load failed"));
      img.src = URL.createObjectURL(file);
    });

  // Invitation History state
  const [invitations, setInvitations] = useState<InvitationRecord[]>([]);
  const [inviteCounts, setInviteCounts] = useState({ registered: 0, pending: 0, smsFailed: 0, expired: 0 });
  const [invitesLoading, setInvitesLoading] = useState(true);

  // SMS Balance state
  const [smsBalance, setSmsBalance] = useState<number | null>(null);
  const [smsLoading, setSmsLoading] = useState(false);

  // Export date filter
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState("");

  // Sign out confirm
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  // PIN change state
  const [showPinChange, setShowPinChange] = useState(false);
  const [currentPin, setCurrentPin] = useState(["", "", "", ""]);
  const [newPin, setNewPin] = useState(["", "", "", ""]);
  const [confirmPin, setConfirmPin] = useState(["", "", "", ""]);
  const [changingPin, setChangingPin] = useState(false);
  const [pinError, setPinError] = useState("");

  // FAB visibility state
  const [fabHiddenState, setFabHiddenState] = useState(false);

  // QR code download/share
  const qrSvgRef = useRef<SVGSVGElement | null>(null);

  // Lazy-load guards
  const smsLoadedRef = useRef(false);
  const accountLoadedRef = useRef(false);

  useEffect(() => {
    setFabHiddenState(isFabHidden());
  }, []);

  useEffect(() => {
    loadProfile();
  }, []);

  // Lazy-load SMS balance only when the Reminders tab is opened
  useEffect(() => {
    if (activeTab === "reminders" && merchantId && !smsLoadedRef.current) {
      smsLoadedRef.current = true;
      setSmsLoading(true);
      getMerchantSmsBalance(merchantId)
        .then((balance) => setSmsBalance(balance))
        .catch(() => {})
        .finally(() => setSmsLoading(false));
    }
  }, [activeTab, merchantId]);

  // Lazy-load invitation history only when the Account tab is opened
  useEffect(() => {
    if (activeTab === "account" && merchantId && !accountLoadedRef.current) {
      accountLoadedRef.current = true;
      setInvitesLoading(true);
      loadInvitations(merchantId);
    }
  }, [activeTab, merchantId]);

  const loadProfile = async () => {
    try {
      let id = await getCurrentMerchantId();

      // Fallback: try session API if localStorage key is missing
      if (!id) {
        try {
          const sessionRes = await fetch("/api/auth/session");
          const sessionData = await sessionRes.json();
          if (sessionData?.userId && typeof sessionData.userId === "string") {
            id = sessionData.userId;
            localStorage.setItem("merchant_id", sessionData.userId);
          }
        } catch {
          // session API unavailable
        }
      }

      setMerchantId(id);

      const sessionPhone = await getCurrentUserPhone();
      setAuthPhone(sessionPhone);

      if (id) {
        const profile = await getMerchantProfile(id);
        const loadedName = profile.name || profile.business_name || "";
        const loadedType = profile.business_type || "kirana";
        const loadedAddress = profile.address || "";
        setMerchantName(loadedName);
        setBusinessType(loadedType);
        setAddress(loadedAddress);
        setInitialMerchantName(loadedName);
        setInitialBusinessType(loadedType);
        setInitialAddress(loadedAddress);
        setPhone(profile.phone || "");
        setPhotoUrl(profile.photo_url || null);
        setPaymentEnabled(profile.payment_enabled !== false);

        // Load payment methods
        loadPaymentMethods(id);

        // Load reminder settings
        loadReminderSettings(id);
      }
    } catch (err) {
      console.error("Failed to load merchant profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadPaymentMethods = async (id: string) => {
    try {
      const methods = await getMerchantPaymentMethods(id);
      const map: Record<string, any> = {};
      for (const m of methods) {
        map[m.method_type] = m;
      }
      setPaymentMethods(map);
    } catch (err) {
      console.error("Failed to load payment methods:", err);
    } finally {
      setPaymentMethodsLoading(false);
    }
  };

  const loadInvitations = async (id: string) => {
    try {
      const data = await getMerchantInvitations(id);
      setInvitations(data.invites);
      setInviteCounts(data.counts);
    } catch (err) {
      console.error("Failed to load invitation history:", err);
    } finally {
      setInvitesLoading(false);
    }
  };

  const loadReminderSettings = async (id: string) => {
    try {
      const settings = await getMerchantReminderSettings(id);
      if (settings) {
        setReminderSettings({
          auto_reminder_enabled: settings.auto_reminder_enabled,
          reminder_message_template: settings.reminder_message_template || "Dear {customer}, pay Rs. {balance} to {shop}.",
          reminder_day_of_month: settings.reminder_day_of_month,
        });
      }
    } catch (err) {
      console.error("Failed to load reminder settings:", err);
    } finally {
      setReminderSettingsLoading(false);
    }
  };

  const maskPhone = (phone: string): string => {
    if (phone.length < 8) return phone;
    const cleaned = phone.replace(/^\+977/, "");
    return cleaned.slice(0, 4) + "****" + cleaned.slice(-2);
  };

  const formatPhone = (p: string) => {
    if (!p) return "";
    const cleaned = p.replace(/^\+977/, "").replace(/^0+/, "");
    return cleaned ? `+977 ${cleaned}` : "";
  };

  const displayPhone = formatPhone(phone || authPhone || "");

  const handleSave = async () => {
    let id = merchantId;

    // Retry from session API if merchantId state is empty
    if (!id) {
      try {
        const sessionRes = await fetch("/api/auth/session");
        const sessionData = await sessionRes.json();
        if (sessionData?.userId && typeof sessionData.userId === "string") {
          id = sessionData.userId;
          setMerchantId(id);
          localStorage.setItem("merchant_id", sessionData.userId);
        }
      } catch {
        // session API unavailable
      }
    }

    if (!id) {
      console.warn("[Settings] handleSave — merchantId is null/undefined");
      addToast("Not logged in", "error");
      return;
    }

    console.log("[Settings] handleSave — merchantId:", id);
    setSaving(true);
    try {
      await updateMerchantProfile(id, {
        name: merchantName.trim() || undefined,
        business_type: businessType,
        address: address.trim() || undefined,
      });
      console.log("[Settings] Profile saved successfully");
      addToast("Profile updated successfully.", "success");
    } catch (err: any) {
      console.error("[Settings] Failed to save merchant profile:", err);
      addToast(err.message || "Failed to save. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Payment method auto-save ──
  const persistMethod = async (key: string, data: Record<string, any>) => {
    if (!merchantId) return;
    setMethodStatus((s) => ({ ...s, [key]: "saving" }));
    try {
      const result = await upsertMerchantPaymentMethod(merchantId, key, {
        label: data?.label || null,
        qr_url: data?.qr_url || null,
        account_holder: data?.account_holder || null,
        account_number: data?.account_number || null,
        bank_name: data?.bank_name || null,
        is_active: data?.is_active ?? false,
        sort_order: data?.sort_order ?? 0,
      });
      if (!result.success) throw new Error(result.error || "Failed to save payment method");
      setMethodStatus((s) => ({ ...s, [key]: "saved" }));
    } catch (err: any) {
      setMethodStatus((s) => ({ ...s, [key]: "error" }));
      addToast(err.message || "Failed to save payment method", "error");
    }
  };

  const updateMethodField = (key: string, patch: Record<string, any>) => {
    const base = paymentMethods[key] || { method_type: key, ...DEFAULT_METHOD };
    const next = { ...base, ...patch };
    setPaymentMethods((prev) => ({ ...prev, [key]: next }));
    setMethodStatus((s) => ({ ...s, [key]: "editing" }));
    if (methodDebounceRef.current[key]) clearTimeout(methodDebounceRef.current[key]);
    methodDebounceRef.current[key] = setTimeout(() => persistMethod(key, next), 900);
  };

  const flushMethod = (key: string) => {
    if (methodDebounceRef.current[key]) {
      clearTimeout(methodDebounceRef.current[key]);
      methodDebounceRef.current[key] = 0 as any;
    }
  };

  const handleToggleMethod = async (key: string, checked: boolean, label: string) => {
    if (!merchantId) return;
    const method = paymentMethods[key];
    if (checked && !canToggleMethod(key, method) && key !== "cash") {
      setExpandedMethod(key);
      addToast(
        `Enter ${key === "bank_deposit" ? "bank details" : "your QR"} to enable ${label}`,
        "warning"
      );
      return;
    }
    const base = method || { method_type: key, ...DEFAULT_METHOD };
    const next = { ...base, is_active: checked };
    setPaymentMethods((prev) => ({ ...prev, [key]: next }));
    flushMethod(key);
    await persistMethod(key, next);
  };

  const methodStatusBadge = (key: string) => {
    const status = methodStatus[key];
    if (!status || status === "idle") return null;
    if (status === "editing" || status === "saving") {
      return <span className="text-[10px] font-medium text-amber-500">Saving…</span>;
    }
    if (status === "saved") {
      return <span className="text-[10px] font-medium text-green-600 dark:text-green-400">Saved ✓</span>;
    }
    return <span className="text-[10px] font-medium text-red-500">Save failed</span>;
  };

  // ── Reminder auto-save ──
  const updateReminder = (patch: Partial<typeof reminderSettings>) => {
    const next = { ...reminderSettings, ...patch };
    setReminderSettings(next);
    setReminderStatus("saving");
    if (reminderDebounceRef.current) clearTimeout(reminderDebounceRef.current);
    reminderDebounceRef.current = setTimeout(() => {
      if (!merchantId) return;
      updateMerchantReminderSettings(merchantId, next)
        .then(() => setReminderStatus("saved"))
        .catch(() => {
          setReminderStatus("idle");
          addToast("Failed to save reminder settings", "error");
        });
    }, 800);
  };

  const handleExport = async (format: "csv" | "json") => {
    setExporting(true);
    try {
      const id = await getCurrentMerchantId();
      if (!id) {
        addToast("Not logged in", "error");
        return;
      }

      const opts: { limit: number; dateFrom?: string; dateTo?: string } = { limit: 1000 };
      if (exportFrom) opts.dateFrom = exportFrom;
      if (exportTo) opts.dateTo = exportTo;

      const logs = await getMerchantCreditLogs(id, opts);

      if (format === "csv") {
        const headers = [
          "Date",
          "Type",
          "Amount",
          "Status",
          "Description",
          "Customer",
        ];
        const rows = (logs as Array<Record<string, unknown>>).map((log) => [
          new Date(log.created_at as string).toLocaleDateString("en-US", { timeZone: "Asia/Kathmandu" }),
          log.type,
          log.amount,
          log.status,
          log.description || "",
          (log.customers as Record<string, string>)?.name || "",
        ]);

        const csvContent = [
          headers.join(","),
          ...rows.map((row) =>
            row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
          ),
        ].join("\n");

        const blob = new Blob([csvContent], {
          type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `qr-hisab-ledger-${
          new Date().toISOString().split("T")[0]
        }.csv`;
        link.click();
        URL.revokeObjectURL(url);

        addToast("CSV exported successfully!", "success");
      } else {
        const jsonContent = JSON.stringify(logs, null, 2);
        const blob = new Blob([jsonContent], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `qr-hisab-ledger-${
          new Date().toISOString().split("T")[0]
        }.json`;
        link.click();
        URL.revokeObjectURL(url);

        addToast("JSON exported successfully!", "success");
      }
    } catch (err) {
      console.error("Failed to export data:", err);
      addToast("Failed to export. Please try again.", "error");
    } finally {
      setExporting(false);
    }
  };

  const handleChangePin = async () => {
    const current = currentPin.join("");
    const newP = newPin.join("");
    const confirm = confirmPin.join("");
    if (current.length < 4) { setPinError("Enter current PIN"); return; }
    if (newP.length < 4) { setPinError("Enter new PIN"); return; }
    if (newP !== confirm) { setPinError("New PINs do not match"); return; }
    if (!merchantId) { setPinError("Not logged in"); return; }
    setChangingPin(true);
    setPinError("");
    try {
      const result = await changePin(merchantId, current, newP);
      if (!result.success) {
        setPinError(result.error || "Failed to change PIN");
        return;
      }
      addToast("PIN changed successfully", "success");
      setCurrentPin(["", "", "", ""]);
      setNewPin(["", "", "", ""]);
      setConfirmPin(["", "", "", ""]);
    } catch {
      setPinError("Failed to change PIN");
    } finally {
      setChangingPin(false);
    }
  };

  // ── PIN inputs: auto-advance, backspace-nav, paste ──
  const handlePinInput = (
    value: string,
    idx: number,
    arr: string[],
    setter: (v: string[]) => void,
    slug: string,
  ) => {
    if (!/^\d*$/.test(value)) return;
    if (value.length > 1) {
      // Paste into a single box
      const digits = value.replace(/\D/g, "").slice(0, 4);
      const next = [...arr];
      for (let j = 0; j < digits.length; j++) next[Math.min(idx + j, 3)] = digits[j];
      setter(next);
      document.getElementById(`pin-${slug}-${Math.min(idx + digits.length, 3)}`)?.focus();
      return;
    }
    const digit = value.slice(-1);
    const next = [...arr];
    next[idx] = digit;
    setter(next);
    if (digit && idx < 3) {
      document.getElementById(`pin-${slug}-${idx + 1}`)?.focus();
    }
  };

  const handlePinKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    idx: number,
    arr: string[],
    slug: string,
  ) => {
    if (e.key === "Backspace" && arr[idx] === "" && idx > 0) {
      document.getElementById(`pin-${slug}-${idx - 1}`)?.focus();
    } else if (e.key === "ArrowLeft" && idx > 0) {
      document.getElementById(`pin-${slug}-${idx - 1}`)?.focus();
    } else if (e.key === "ArrowRight" && idx < 3) {
      document.getElementById(`pin-${slug}-${idx + 1}`)?.focus();
    }
  };

  const renderPinInputs = (arr: string[], setter: (v: string[]) => void, label: string) => {
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return (
      <div>
        <label className="block text-xs text-[var(--color-text-muted)] mb-1.5">{label}</label>
        <div
          className="flex gap-2"
          onPaste={(e) => {
            const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
            if (digits.length === 4) {
              e.preventDefault();
              setter([...digits]);
              document.getElementById(`pin-${slug}-3`)?.focus();
            }
          }}
        >
          {arr.map((d, i) => (
            <input
              key={i}
              id={`pin-${slug}-${i}`}
              type="tel"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={1}
              value={d}
              onChange={(e) => handlePinInput(e.target.value, i, arr, setter, slug)}
              onKeyDown={(e) => handlePinKeyDown(e, i, arr, slug)}
              onFocus={(e) => e.target.select()}
              className="w-10 h-10 text-center text-lg font-bold bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
            />
          ))}
        </div>
      </div>
    );
  };

  // ── QR download / share ──
  const qrToCanvas = (): Promise<HTMLCanvasElement | null> => {
    const svg = qrSvgRef.current;
    if (!svg) return Promise.resolve(null);
    let svgString = new XMLSerializer().serializeToString(svg);
    if (!svgString.includes("xmlns")) {
      svgString = svgString.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = 4;
        canvas.width = img.width * scale || 520;
        canvas.height = img.height * scale || 520;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  };

  const downloadQr = async () => {
    const canvas = await qrToCanvas();
    if (!canvas) {
      addToast("Could not generate QR image", "error");
      return;
    }
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${(merchantName || "my-shop").toLowerCase().replace(/\s+/g, "-")}-qr.png`;
    a.click();
    addToast("QR code downloaded!", "success");
  };

  const shareQr = async () => {
    const canvas = await qrToCanvas();
    if (!canvas) {
      addToast("Could not generate QR image", "error");
      return;
    }
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], "shop-qr.png", { type: "image/png" });
      const nav = navigator as any;
      try {
        if (nav.share && nav.canShare?.({ files: [file] })) {
          await nav.share({ title: "My Shop QR", text: "Scan to record credit", files: [file] });
        } else {
          addToast("Sharing not supported here — use Download instead", "warning");
        }
      } catch {
        // User cancelled the share sheet
      }
    }, "image/png");
  };

  const TABS: { key: TabKey; label: string; icon: string }[] = [
    { key: "shop", label: "Shop", icon: "🏪" },
    { key: "payments", label: "Payments", icon: "💳" },
    { key: "reminders", label: "Reminders", icon: "🔔" },
    { key: "account", label: "Account", icon: "⚙️" },
  ];

  return (
    <div className="pb-20">
      {/* Header + tab bar */}
      <div className="sticky top-0 z-40 bg-[var(--color-bg)]/80 backdrop-blur-md border-b border-[var(--color-border)]">
        <div className="flex items-center px-4 py-3">
          <a
            href="/merchant/dashboard"
            aria-label="Back to dashboard"
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
          <h1 className="text-lg font-extrabold text-[var(--color-text)]">
            Settings ⚙️
          </h1>
        </div>
        <nav className="flex px-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              aria-current={activeTab === t.key ? "page" : undefined}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === t.key
                  ? "text-[var(--color-primary)] border-[var(--color-primary)]"
                  : "text-[var(--color-text-muted)] border-transparent"
              }`}
            >
              <span aria-hidden="true">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="px-4 py-4 space-y-6">
        {/* ═══════════════════ SHOP TAB ═══════════════════ */}
        {activeTab === "shop" && (
          <div className="space-y-6">
          {/* Your Shop QR — the hero asset, placed at the top */}
          <section>
            <h2 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
              Your Shop QR
            </h2>
            <div className="bg-[var(--color-surface)] rounded-2xl shadow-sm border border-[var(--color-border)] p-4">
              {merchantId ? (
                <>
                  <QRDisplay
                    svgRef={qrSvgRef}
                    merchantId={merchantId}
                    merchantName={merchantName || "Shop"}
                    businessType={businessType}
                  />
                  {!merchantName && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 text-center -mt-3">
                      Add your shop name below so customers see who they&apos;re paying.
                    </p>
                  )}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={downloadQr}
                      className="flex-1 py-2.5 bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] rounded-xl text-sm font-medium active:scale-[0.98] transition-transform flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      Download
                    </button>
                    <button
                      onClick={shareQr}
                      className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium active:scale-[0.98] transition-transform flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                      </svg>
                      Share
                    </button>
                    <a
                      href="/merchant/qr"
                      className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium active:scale-[0.98] transition-transform flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
                      </svg>
                      Print
                    </a>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          </section>

          {/* Profile Section */}
          <section>
            <h2 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
              Shop Profile
            </h2>
            <div className="bg-[var(--color-surface)] rounded-2xl shadow-sm border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
              {/* Profile Photo */}
              <div className="p-4">
                <label className="block text-sm font-medium text-[var(--color-text)] mb-3">
                  Profile Photo
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-[var(--color-border)]">
                    {photoUrl ? (
                      <img src={photoUrl} alt="Profile" loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <svg className="w-8 h-8 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] rounded-xl text-sm font-medium cursor-pointer active:scale-[0.98] transition-transform">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                      </svg>
                      {photoUploading ? "Uploading..." : "Change Photo"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !merchantId) return;
                          setPhotoUploading(true);
                          try {
                            const resized = await resizeImage(file, 512);
                            const uploadFile = new File([resized], file.name.replace(/\.[^.]+$/, ".webp"), { type: "image/webp" });
                            const formData = new FormData();
                            formData.append("file", uploadFile);
                            formData.append("merchantId", merchantId);
                            const res = await fetch("/api/merchant/upload-photo", { method: "POST", body: formData });
                            const data = await res.json();
                            if (data.url) {
                              setPhotoUrl(data.url);
                              addToast("Photo updated!", "success");
                            } else {
                              addToast(data.error || "Upload failed", "error");
                            }
                          } catch {
                            addToast("Upload failed. Please try again.", "error");
                          } finally {
                            setPhotoUploading(false);
                          }
                        }}
                      />
                    </label>
                    {photoUrl && (
                      <button
                        onClick={async () => {
                          if (!merchantId) return;
                          try {
                            await updateMerchantProfile(merchantId, { photo_url: null });
                            setPhotoUrl(null);
                            addToast("Photo removed", "success");
                          } catch {
                            addToast("Failed to remove photo", "error");
                          }
                        }}
                        className="block mt-2 text-xs text-red-500 dark:text-red-400 font-medium active:opacity-70"
                      >
                        Remove Photo
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Business Name (editable — maps to DB `name` column) */}
              <div className="p-4">
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
                  Business Name
                </label>
                <input
                  type="text"
                  value={merchantName}
                  onChange={(e) => setMerchantName(e.target.value)}
                  disabled={loading}
                  placeholder="Input your business name here"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-800 rounded-xl text-sm border border-gray-200 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all placeholder:text-gray-300 disabled:opacity-60"
                />
              </div>

              {/* Business Type */}
              <div className="p-4">
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
                  Business Type
                </label>
                <div className="relative">
                  <select
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                    disabled={loading}
                    className="w-full px-3.5 py-2.5 pr-10 bg-white dark:bg-gray-800 rounded-xl text-sm border border-gray-200 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all capitalize appearance-none disabled:opacity-60"
                  >
                    <option value="kirana">Kirana</option>
                    <option value="dairy">Dairy</option>
                    <option value="meat">Meat</option>
                    <option value="hardware">Hardware</option>
                    <option value="clothing">Clothing</option>
                    <option value="pharmacy">Pharmacy</option>
                    <option value="restaurant">Restaurant</option>
                    <option value="other">Other</option>
                  </select>
                  <svg
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </div>

              {/* Address */}
              <div className="p-4">
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
                  Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={loading}
                  placeholder="e.g. Kathmandu, Nepal"
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-800 rounded-xl text-sm border border-gray-200 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all placeholder:text-gray-300 disabled:opacity-60"
                />
              </div>

              {/* Phone Number (Read-Only) */}
              <div className="p-4">
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
                  Registered Business Phone
                </label>
                {loading ? (
                  <div className="px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                    <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </div>
                ) : (
                  <div className="px-3.5 py-2.5 bg-[var(--color-primary)]/5 rounded-xl text-sm font-mono text-[var(--color-primary-dark)] border border-[var(--color-primary)]/10 flex items-center gap-2">
                    <svg className="w-4 h-4 text-[var(--color-primary)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{displayPhone}</span>
                  </div>
                )}
                {!loading && authPhone && authPhone !== phone && (
                  <p className="text-xs text-[var(--color-text-muted)] mt-1.5 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    Auth phone: {authPhone} (differs from business phone)
                  </p>
                )}
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={saving || loading || (merchantName.trim() === initialMerchantName && businessType === initialBusinessType && address.trim() === initialAddress)}
              className="w-full mt-4 py-3 bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-[var(--color-bg)] border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12.75l6 6 9-13.5"
                    />
                  </svg>
                  Save Changes
                </>
              )}
            </button>
          </section>
        </div>
        )}

        {/* ═══════════════════ PAYMENTS TAB ═══════════════════ */}
        {activeTab === "payments" && (
          <div className="space-y-6">
          {/* Payment Methods Section */}
          <section>
            <h2 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
              Receive Payments
            </h2>

            {/* Master toggle */}
            <div className="bg-[var(--color-surface)] rounded-2xl shadow-sm border border-[var(--color-border)] p-4 mb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--color-text)]">Accept Payments</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {paymentEnabled
                      ? "Payments active — customers can pay you"
                      : "Payments paused — all methods are off"}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    role="switch"
                    aria-label="Toggle payment option"
                    checked={paymentEnabled}
                    disabled={togglingPaymentOption}
                    onChange={async (e) => {
                      if (!merchantId) return;
                      const newValue = e.target.checked;
                      const prevValue = paymentEnabled;
                      setPaymentEnabled(newValue);
                      setTogglingPaymentOption(true);
                      try {
                        const res = await togglePaymentOption(merchantId!, newValue);
                        if (!res.success) throw new Error(res.error);
                        addToast("Payment options updated successfully!", "success");
                      } catch (err: any) {
                        setPaymentEnabled(prevValue);
                        addToast(err.message || "Failed to update payment option", "error");
                      } finally {
                        setTogglingPaymentOption(false);
                      }
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--color-primary-surface)] peer-disabled:opacity-50" />
                </label>
              </div>
              {!paymentEnabled && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                  Individual payment methods below are disabled while payments are paused.
                </p>
              )}
            </div>

            {paymentMethodsLoading ? (
              <div className="bg-[var(--color-surface)] rounded-2xl shadow-sm border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="p-4 flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                      <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    </div>
                    <div className="w-9 h-5 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-[var(--color-surface)] rounded-2xl shadow-sm border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
                {PAYMENT_TYPES.map((pt) => {
                  const method = paymentMethods[pt.key];
                  const isActive = method?.is_active ?? false;
                  const expanded = expandedMethod === pt.key;
                  const saving = savingPaymentMethod === pt.key;
                  const showSwitch = pt.key === "cash" || isActive || canToggleMethod(pt.key, method);

                  return (
                    <div key={pt.key} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className="text-lg flex-shrink-0" role="img" aria-label={pt.label}>{pt.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[var(--color-text)]">{pt.label}</p>
                            {method?.label && (
                              <p className="text-xs text-[var(--color-text-muted)] truncate">{method.label}</p>
                            )}
                            {methodStatusBadge(pt.key)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {showSwitch ? (
                            <label className={`relative inline-flex items-center ${paymentEnabled ? "cursor-pointer" : "cursor-not-allowed"}`}>
                              <input
                                type="checkbox"
                                role="switch"
                                aria-label="Toggle payment method"
                                checked={isActive}
                                disabled={!paymentEnabled || togglingPaymentOption || saving}
                                onChange={(e) => {
                                  if (!paymentEnabled) return;
                                  handleToggleMethod(pt.key, e.target.checked, pt.label);
                                }}
                                className="sr-only peer"
                              />
                              <div className={`w-9 h-5 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--color-primary-surface)] ${!paymentEnabled ? "opacity-40" : ""}`} />
                            </label>
                          ) : (
                            <button
                              onClick={() => setExpandedMethod(expanded ? null : pt.key)}
                              className="px-2.5 py-1.5 bg-[var(--color-primary)]/10 text-[var(--color-primary)] rounded-lg text-xs font-semibold active:scale-95 transition-transform"
                            >
                              Set up
                            </button>
                          )}
                          <button
                            onClick={() => setExpandedMethod(expanded ? null : pt.key)}
                            className="p-1 active:scale-90 transition-transform"
                          >
                            <svg className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {expanded && (
                        <div className="mt-3 pt-3 border-t border-[var(--color-border)] space-y-3">
                          {/* Label field for all except cash */}
                          {pt.key !== "cash" && (
                            <div>
                              <label className="block text-xs text-[var(--color-text-muted)] mb-1">Label</label>
                              <input
                                type="text"
                                value={method?.label || ""}
                                onChange={(e) => updateMethodField(pt.key, { label: e.target.value || null })}
                                placeholder={pt.label}
                                className="w-full px-3 py-2 bg-white dark:bg-gray-800 rounded-xl text-sm border border-gray-200 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none placeholder:text-gray-300"
                              />
                            </div>
                          )}

                          {/* QR upload for QR-based methods */}
                          {pt.hasQr && (
                            <div>
                              <label className="block text-xs text-[var(--color-text-muted)] mb-1">QR Code Image</label>
                              {method?.qr_url && (
                                <div className="mb-2">
                                  <img
                                    src={method.qr_url}
                                    alt={`${pt.label} QR`}
                                    className="w-24 h-24 object-contain rounded-lg border border-[var(--color-border)]"
                                  />
                                </div>
                              )}
                              <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium cursor-pointer active:scale-[0.98] transition-transform">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                                </svg>
                                {uploadingQrFor === pt.key ? "Uploading..." : (method?.qr_url ? "Change QR" : "Upload QR")}
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file || !merchantId) return;
                                    setUploadingQrFor(pt.key);
                                    try {
                                      const resized = await resizeImage(file, 512);
                                      const uploadFile = new File([resized], file.name.replace(/\.[^.]+$/, ".webp"), { type: "image/webp" });
                                      const formData = new FormData();
                                      formData.append("file", uploadFile);
                                      formData.append("merchantId", merchantId);
                                      formData.append("methodType", pt.key);
                                      const res = await fetch("/api/merchant/upload-payment-qr", { method: "POST", body: formData });
                                      const data = await res.json();
                                      if (data.url) {
                                        updateMethodField(pt.key, { qr_url: data.url });
                                        addToast("QR uploaded!", "success");
                                      } else {
                                        addToast(data.error || "Upload failed", "error");
                                      }
                                    } catch {
                                      addToast("Upload failed", "error");
                                    } finally {
                                      setUploadingQrFor(null);
                                    }
                                  }}
                                />
                              </label>
                              {method?.qr_url && (
                                <button
                                  onClick={() => updateMethodField(pt.key, { qr_url: null })}
                                  className="block mt-1 text-xs text-red-500 dark:text-red-400 font-medium active:opacity-70"
                                >
                                  Remove QR
                                </button>
                              )}
                            </div>
                          )}

                          {/* Bank deposit fields */}
                          {pt.key === "bank_deposit" && (
                            <>
                              <div>
                                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Account Holder Name</label>
                                <input
                                  type="text"
                                  value={method?.account_holder || ""}
                                  onChange={(e) => updateMethodField(pt.key, { account_holder: e.target.value || null })}
                                  placeholder="e.g. Ram Shrestha"
                                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 rounded-xl text-sm border border-gray-200 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none placeholder:text-gray-300"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Account Number</label>
                                <input
                                  type="text"
                                  value={method?.account_number || ""}
                                  onChange={(e) => updateMethodField(pt.key, { account_number: e.target.value || null })}
                                  placeholder="e.g. 1234567890"
                                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 rounded-xl text-sm border border-gray-200 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none placeholder:text-gray-300"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-[var(--color-text-muted)] mb-1">Bank Name</label>
                                <input
                                  type="text"
                                  value={method?.bank_name || ""}
                                  onChange={(e) => updateMethodField(pt.key, { bank_name: e.target.value || null })}
                                  placeholder="e.g. NMB Bank"
                                  className="w-full px-3 py-2 bg-white dark:bg-gray-800 rounded-xl text-sm border border-gray-200 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none placeholder:text-gray-300"
                                />
                              </div>
                            </>
                          )}

                          {/* Cash: no extra fields needed */}

                          {/* Auto-save status */}
                          <div className="flex items-center justify-between pt-1">
                            <p className="text-[10px] text-[var(--color-text-muted)]">
                              {saving ? "Saving…" : "Changes save automatically."}
                            </p>
                            {methodStatusBadge(pt.key)}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-[var(--color-text-muted)] mt-2">
              Customers will see enabled payment methods when making payments.
            </p>
          </section>
        </div>
        )}

        {/* ═══════════════════ REMINDERS TAB ═══════════════════ */}
        {activeTab === "reminders" && (
          <div className="space-y-6">
          {/* SMS Balance Section */}
          <section>
            <h2 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
              SMS Credits
            </h2>
            {smsLoading ? (
              <div className="bg-[var(--color-surface)] rounded-2xl shadow-sm border border-[var(--color-border)] p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    <div className="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </div>
                </div>
              </div>
            ) : smsBalance !== null ? (
              <a
                href="/merchant/billing"
                className="block bg-[var(--color-surface)] rounded-2xl shadow-sm border border-[var(--color-border)] p-4 active:scale-[0.99] transition-transform"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-500 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-sm text-[var(--color-text)]">SMS Balance</p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {smsBalance} credit{smsBalance !== 1 ? "s" : ""} remaining
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {smsBalance <= 5 && (
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded-full">
                        LOW
                      </span>
                    )}
                    <svg className="w-4 h-4 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                </div>
              </a>
            ) : null}

            {/* Reminder Settings Section */}
            <h2 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3 mt-6">
              Auto Reminder
            </h2>
            {reminderSettingsLoading ? (
              <div className="bg-[var(--color-surface)] rounded-2xl shadow-sm border border-[var(--color-border)] p-4 space-y-3">
                <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
              </div>
            ) : (
              <div className="bg-[var(--color-surface)] rounded-2xl shadow-sm border border-[var(--color-border)] p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text)]">End-of-Month SMS Reminder</p>
                    <p className="text-xs text-[var(--color-text-muted)]">Auto-send SMS to customers with balance</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {reminderStatus === "saving" && <span className="text-[10px] font-medium text-amber-500">Saving…</span>}
                    {reminderStatus === "saved" && <span className="text-[10px] font-medium text-green-600 dark:text-green-400">Saved ✓</span>}
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        role="switch"
                        aria-label="Toggle auto reminder"
                        checked={reminderSettings.auto_reminder_enabled}
                        onChange={(e) => updateReminder({ auto_reminder_enabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--color-primary-surface)]" />
                    </label>
                  </div>
                </div>

                {reminderSettings.auto_reminder_enabled && (
                  <>
                    <div>
                      <label className="block text-xs text-[var(--color-text-muted)] mb-1">Reminder Day of Month</label>
                      <select
                        value={reminderSettings.reminder_day_of_month}
                        onChange={(e) => updateReminder({ reminder_day_of_month: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 rounded-xl text-sm border border-gray-200 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none"
                      >
                        {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                          <option key={d} value={d}>{d}{d === 1 ? "st" : d === 2 ? "nd" : d === 3 ? "rd" : "th"} day</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-[var(--color-text-muted)] mb-1">Message Template</label>
                      <textarea
                        value={reminderSettings.reminder_message_template}
                        onChange={(e) => {
                          if (e.target.value.length <= 150) {
                            updateReminder({ reminder_message_template: e.target.value });
                          }
                        }}
                        maxLength={150}
                        rows={2}
                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 rounded-xl text-sm border border-gray-200 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none resize-none"
                      />
                      <p className="text-xs text-[var(--color-text-muted)] text-right mt-1">
                        {reminderSettings.reminder_message_template.length}/150
                      </p>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
                      <p className="text-xs text-[var(--color-text-muted)] mb-1">Preview:</p>
                      <p className="text-sm text-[var(--color-text)]">
                        {reminderSettings.reminder_message_template
                          .replace("{customer}", "Ram")
                          .replace("{balance}", "1,500")
                          .replace("{shop}", (merchantName || "Shop").split(" ")[0])
                        }
                      </p>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
                      <p className="text-xs text-[var(--color-text-muted)] mb-1">Available placeholders:</p>
                      <p className="text-xs text-[var(--color-text)] space-x-3">
                        <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">{"{customer}"}</code> customer name
                        <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded ml-2">{"{balance}"}</code> due amount
                        <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded ml-2">{"{shop}"}</code> shop name
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </section>
        </div>
        )}

        {/* ═══════════════════ ACCOUNT TAB ═══════════════════ */}
        {activeTab === "account" && (
          <div className="space-y-6">
          {/* PIN Change Section */}
          <section>
            <h2 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
              PIN Security
            </h2>
            <div className="bg-[var(--color-surface)] rounded-2xl shadow-sm border border-[var(--color-border)] p-4">
              {!showPinChange ? (
                <button
                  onClick={() => { setShowPinChange(true); setPinError(""); }}
                  className="w-full py-2.5 bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] rounded-xl text-sm font-semibold active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  Change PIN
                </button>
              ) : (
                <div className="space-y-4">
                  {renderPinInputs(currentPin, setCurrentPin, "Current PIN")}
                  {renderPinInputs(newPin, setNewPin, "New PIN")}
                  {renderPinInputs(confirmPin, setConfirmPin, "Confirm New PIN")}
                  {pinError && (
                    <div className="bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 text-xs px-3 py-2 rounded-lg">{pinError}</div>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setShowPinChange(false); setPinError(""); setCurrentPin(["", "", "", ""]); setNewPin(["", "", "", ""]); setConfirmPin(["", "", "", ""]); }}
                      className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-medium active:scale-[0.98] transition-transform"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleChangePin}
                      disabled={changingPin}
                      className="flex-1 py-2.5 bg-[var(--color-primary-surface)] text-[var(--color-primary-foreground)] rounded-xl text-sm font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {changingPin ? (
                        <div className="w-4 h-4 border-2 border-[var(--color-bg)] border-t-transparent rounded-full animate-spin" />
                      ) : (
                        "Update PIN"
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Export Section */}
          <section>
            <h2 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
              Export Data
            </h2>
            <div className="bg-[var(--color-surface)] rounded-2xl shadow-sm border border-[var(--color-border)] p-4 mb-2">
              <label className="block text-xs text-[var(--color-text-muted)] mb-2">Date Range (optional)</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="export-from" className="block text-[10px] text-[var(--color-text-muted)] mb-1">From</label>
                  <input
                    id="export-from"
                    type="date"
                    value={exportFrom}
                    max={exportTo || undefined}
                    onChange={(e) => setExportFrom(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 rounded-xl text-sm border border-gray-200 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="export-to" className="block text-[10px] text-[var(--color-text-muted)] mb-1">To</label>
                  <input
                    id="export-to"
                    type="date"
                    value={exportTo}
                    min={exportFrom || undefined}
                    onChange={(e) => setExportTo(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-800 rounded-xl text-sm border border-gray-200 dark:border-gray-700 dark:text-white focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none"
                  />
                </div>
              </div>
              {(exportFrom || exportTo) && (
                <button
                  onClick={() => { setExportFrom(""); setExportTo(""); }}
                  className="mt-2 text-xs text-[var(--color-primary)] font-medium active:opacity-70"
                >
                  Clear date range
                </button>
              )}
            </div>
            <div className="space-y-2">
              <button
                onClick={() => handleExport("csv")}
                disabled={exporting}
                className="w-full flex items-center gap-3 p-4 bg-[var(--color-surface)] rounded-2xl shadow-sm border border-[var(--color-border)] active:scale-[0.99] transition-transform disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-green-600 dark:text-green-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                    />
                  </svg>
                </div>
                <div className="text-left flex-1">
                  <p className="font-medium text-sm text-[var(--color-text)]">
                    Export as CSV
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Spreadsheet for accounting
                  </p>
                </div>
                {exporting && (
                  <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-600 border-t-gray-600 dark:border-t-gray-300 rounded-full animate-spin" />
                )}
              </button>
              <button
                onClick={() => handleExport("json")}
                disabled={exporting}
                className="w-full flex items-center gap-3 p-4 bg-[var(--color-surface)] rounded-2xl shadow-sm border border-[var(--color-border)] active:scale-[0.99] transition-transform disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-blue-600 dark:text-blue-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                    />
                  </svg>
                </div>
                <div className="text-left flex-1">
                  <p className="font-medium text-sm text-[var(--color-text)]">
                    Export as JSON
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Raw data backup
                  </p>
                </div>
                {exporting && (
                  <div className="w-4 h-4 border-2 border-gray-300 dark:border-gray-600 border-t-gray-600 dark:border-t-gray-300 rounded-full animate-spin" />
                )}
              </button>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-2">
              Exports include up to the most recent 1000 entries — use the date range above for older records.
            </p>
          </section>

          {/* Preferences Section */}
          <section>
            <h2 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
              Preferences
            </h2>
            <div className="bg-[var(--color-surface)] rounded-2xl shadow-sm border border-[var(--color-border)] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--color-text)]">Show Quick Action Button</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Floating + button on all screens</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    role="switch"
                    aria-label="Toggle quick action button"
                    checked={!fabHiddenState}
                    onChange={(e) => {
                      const hide = !e.target.checked;
                      setFabHidden(hide);
                      setFabHiddenState(hide);
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--color-primary-surface)]" />
                </label>
              </div>
            </div>
          </section>

          {/* Invitation History Section */}
          <section>
            <h2 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
              Invitation History
            </h2>
            <div className="bg-[var(--color-surface)] rounded-2xl shadow-sm border border-[var(--color-border)] p-4">
              {invitesLoading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="w-5 h-5 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : invitations.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)] text-center py-4">
                  No invitations sent yet.
                </p>
              ) : (
                <>
                  {/* Counters */}
                  <div className="flex gap-3 text-sm mb-4 flex-wrap">
                    <span className="text-green-600 dark:text-green-400 font-medium">Registered ({inviteCounts.registered})</span>
                    <span className="text-blue-600 dark:text-blue-400 font-medium">Pending ({inviteCounts.pending})</span>
                    <span className="text-red-600 dark:text-red-400 font-medium">Failed ({inviteCounts.smsFailed})</span>
                    <span className="text-gray-500 dark:text-gray-400 font-medium">Expired ({inviteCounts.expired})</span>
                  </div>

                  {/* Invite list */}
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {invitations.map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-[var(--color-text)]">
                            {maskPhone(inv.phone)}
                          </p>
                          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                            {new Date(inv.created_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                            {inv.completed_at && (
                              <> · Registered {new Date(inv.completed_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                              </>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            inv.status === "registration_completed" ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300" :
                            ["sms_sent", "invitation_opened", "otp_verified"].includes(inv.status) ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" :
                            inv.status === "sms_failed" ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300" :
                            inv.status === "expired" || (inv.status === "pending" && new Date(inv.expires_at) < new Date()) ? "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400" :
                            inv.status === "cancelled" ? "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400" :
                            "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                          }`}>
                            {inv.status === "registration_completed" ? "Registered" :
                             inv.status === "sms_sent" ? "Sent" :
                             inv.status === "invitation_opened" ? "Opened" :
                             inv.status === "otp_verified" ? "OTP Done" :
                             inv.status === "sms_failed" ? "Failed" :
                             inv.status === "expired" || (inv.status === "pending" && new Date(inv.expires_at) < new Date()) ? "Expired" :
                             inv.status === "cancelled" ? "Cancelled" :
                             "Pending"}
                          </span>
                          {["sms_failed", "expired"].includes(inv.status) && (
                            <button
                              onClick={async () => {
                                try {
                                  const result = await resendInvitation(merchantId!, inv.id);
                                  if (result.success) {
                                    addToast("Invitation resent successfully!", "success");
                                    if (merchantId) loadInvitations(merchantId);
                                  } else {
                                    addToast(result.error || "Failed to resend", "error");
                                  }
                                } catch {
                                  addToast("Failed to resend invitation", "error");
                                }
                              }}
                              className="text-xs text-[var(--color-primary)] font-medium active:opacity-70"
                            >
                              Resend
                            </button>
                          )}
                          {inv.status === "pending" && (
                            <button
                              onClick={async () => {
                                try {
                                  const result = await cancelInvitation(merchantId!, inv.id);
                                  if (result.success) {
                                    addToast("Invitation cancelled", "success");
                                    if (merchantId) loadInvitations(merchantId);
                                  } else {
                                    addToast(result.error || "Failed to cancel", "error");
                                  }
                                } catch {
                                  addToast("Failed to cancel invitation", "error");
                                }
                              }}
                              className="text-xs text-red-500 dark:text-red-400 font-medium active:opacity-70"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Account Section */}
          <section>
            <h2 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
              Account
            </h2>
            <button
              onClick={() => setShowSignOutConfirm(true)}
              className="w-full flex items-center gap-3 p-4 bg-[var(--color-surface)] rounded-2xl shadow-sm border border-[var(--color-border)] active:scale-[0.99] transition-transform"
            >
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-red-500 dark:text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
                  />
                </svg>
              </div>
              <div className="text-left">
                <p className="font-medium text-sm text-red-600 dark:text-red-400">Sign Out</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Log out of your account
                </p>
              </div>
            </button>
          </section>

          {/* About Section */}
          <section>
            <h2 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
              About
            </h2>
            <div className="bg-[var(--color-surface)] rounded-2xl shadow-sm border border-[var(--color-border)] p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--color-primary-surface)] to-[var(--color-primary-surface-dark)] flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-extrabold text-[var(--color-primary)]">
                    QR Hisab ✨
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Made with ❤️ in Nepal · v1.0.0
                  </p>
                </div>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                Nepal&apos;s friendly digital khata for small retail
                shops — built to replace traditional Udharo registers. Works offline too! 📱
              </p>
            </div>
          </section>
        </div>
        )}
      </div>

      {/* Sign out confirmation modal */}
      {showSignOutConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6">
          <div className="bg-[var(--color-surface)] rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <h3 className="text-base font-bold text-[var(--color-text)]">Sign out?</h3>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              You&apos;ll need to log in again with your PIN to continue.
            </p>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowSignOutConfirm(false)}
                className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-medium active:scale-[0.98] transition-transform"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setShowSignOutConfirm(false);
                  await signOut();
                }}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold active:scale-[0.98] transition-transform"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
