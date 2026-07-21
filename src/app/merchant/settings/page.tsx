"use client";

import { useState, useEffect } from "react";
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

export default function SettingsPage() {
  const { addToast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);

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
  const [savingReminder, setSavingReminder] = useState(false);

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

  // SMS Balance state
  const [smsBalance, setSmsBalance] = useState<number | null>(null);

  // PIN change state
  const [showPinChange, setShowPinChange] = useState(false);
  const [currentPin, setCurrentPin] = useState(["", "", "", ""]);
  const [newPin, setNewPin] = useState(["", "", "", ""]);
  const [confirmPin, setConfirmPin] = useState(["", "", "", ""]);
  const [changingPin, setChangingPin] = useState(false);
  const [pinError, setPinError] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

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

        // Load SMS balance
        try {
          const balance = await getMerchantSmsBalance(id);
          setSmsBalance(balance);
        } catch {
          // Non-critical
        }
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

  const handleExport = async (format: "csv" | "json") => {
    setExporting(true);
    try {
      const id = await getCurrentMerchantId();
      if (!id) {
        addToast("Not logged in", "error");
        return;
      }

      const logs = await getMerchantCreditLogs(id, { limit: 1000 });

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

  const handlePinDigit = (
    value: string,
    idx: number,
    arr: string[],
    setter: (v: string[]) => void,
  ) => {
    if (!/^\d*$/.test(value)) return;
    const digit = value.slice(-1);
    const next = [...arr];
    next[idx] = digit;
    setter(next);
  };

  const renderPinInputs = (arr: string[], setter: (v: string[]) => void, label: string) => (
    <div>
      <label className="block text-xs text-[var(--color-text-muted)] mb-1.5">{label}</label>
      <div className="flex gap-2">
        {arr.map((d, i) => (
          <input
            key={i}
            type="tel"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={(e) => handlePinDigit(e.target.value, i, arr, setter)}
            onFocus={(e) => e.target.select()}
            className="w-10 h-10 text-center text-lg font-bold bg-white rounded-lg border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all"
          />
        ))}
      </div>
    </div>
  );

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
            Settings
          </h1>
        </div>
      </div>

      <div className="px-4 py-4 space-y-6">
        {/* Profile Section */}
        <section>
          <h2 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
            Shop Profile
          </h2>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-50 divide-y divide-gray-50">
            {/* Profile Photo */}
            <div className="p-4">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-3">
                Profile Photo
              </label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-gray-200">
                  {photoUrl ? (
                    <img src={photoUrl} alt="Profile" loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-xl text-sm font-medium cursor-pointer active:scale-[0.98] transition-transform">
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
                      className="block mt-2 text-xs text-red-500 font-medium active:opacity-70"
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
                placeholder="Input your business name here"
                className="w-full px-3.5 py-2.5 bg-white rounded-xl text-sm border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all placeholder:text-gray-300"
              />
            </div>

            {/* Business Type */}
            <div className="p-4">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
                Business Type
              </label>
              <select
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white rounded-xl text-sm border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all capitalize appearance-none"
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
                placeholder="e.g. Kathmandu, Nepal"
                className="w-full px-3.5 py-2.5 bg-white rounded-xl text-sm border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all placeholder:text-gray-300"
              />
            </div>

            {/* Phone Number (Read-Only) */}
            <div className="p-4">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
                Registered Business Phone
              </label>
              {loading ? (
                <div className="px-3.5 py-2.5 bg-gray-50 rounded-xl">
                  <div className="h-5 w-40 bg-gray-200 rounded animate-pulse" />
                </div>
              ) : (
                <div className="px-3.5 py-2.5 bg-emerald-50 rounded-xl text-sm font-mono text-emerald-700 border border-emerald-100 flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
            disabled={saving || (merchantName.trim() === initialMerchantName && businessType === initialBusinessType && address.trim() === initialAddress)}
            className="w-full mt-4 py-3 bg-[var(--color-primary)] text-white rounded-xl font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
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

        {/* Payment Methods Section */}
        <section>
          <h2 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
            Receive Payments
          </h2>

          {/* Master toggle */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-50 p-4 mb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--color-text)]">Payment Option</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  {paymentEnabled ? "Customers can pay you" : "Payments are paused"}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
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
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--color-primary)] peer-disabled:opacity-50" />
              </label>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-50 divide-y divide-gray-50">
            {PAYMENT_TYPES.map((pt) => {
              const method = paymentMethods[pt.key];
              const isActive = method?.is_active ?? false;
              const expanded = expandedMethod === pt.key;
              const saving = savingPaymentMethod === pt.key;

              return (
                <div key={pt.key} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-lg flex-shrink-0">{pt.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text)]">{pt.label}</p>
                        {method?.label && (
                          <p className="text-xs text-[var(--color-text-muted)] truncate">{method.label}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isActive}
                          onChange={async (e) => {
                            if (!merchantId) return;
                            // Validate required details before enabling
                            if (e.target.checked && !canToggleMethod(pt.key, method)) {
                              addToast("Please expand the payment method and enter your details first!", "warning");
                              return;
                            }
                            setSavingPaymentMethod(pt.key);
                            const prevActive = method?.is_active ?? false;
                            try {
                              const result = await upsertMerchantPaymentMethod(merchantId, pt.key, {
                                is_active: e.target.checked,
                              });
                              if (!result.success) {
                                throw new Error(result.error || "Failed to update payment method");
                              }
                              const updated = { ...paymentMethods };
                              if (!updated[pt.key]) {
                                updated[pt.key] = {
                                  method_type: pt.key, label: null, qr_url: null,
                                  account_holder: null, account_number: null, bank_name: null,
                                  is_active: e.target.checked, sort_order: 0,
                                };
                              } else {
                                updated[pt.key] = { ...updated[pt.key], is_active: e.target.checked };
                              }
                              setPaymentMethods(updated);
                              addToast(`${pt.label} ${e.target.checked ? "enabled" : "disabled"}`, "success");
                            } catch (err: any) {
                              // Rollback local state on failure
                              const rolledBack = { ...paymentMethods };
                              if (rolledBack[pt.key]) {
                                rolledBack[pt.key] = { ...rolledBack[pt.key], is_active: prevActive };
                                setPaymentMethods(rolledBack);
                              }
                              addToast(err.message || `Failed to update ${pt.label}`, "error");
                            } finally {
                              setSavingPaymentMethod(null);
                            }
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--color-primary)]" />
                      </label>
                      <button
                        onClick={() => setExpandedMethod(expanded ? null : pt.key)}
                        className="p-1 active:scale-90 transition-transform"
                      >
                        <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                      {/* Label field for all except cash */}
                      {pt.key !== "cash" && (
                        <div>
                          <label className="block text-xs text-[var(--color-text-muted)] mb-1">Label</label>
                          <input
                            type="text"
                            value={method?.label || ""}
                            onChange={(e) => {
                              const updated = { ...paymentMethods };
                              if (!updated[pt.key]) {
                                updated[pt.key] = { method_type: pt.key, label: null, qr_url: null, account_holder: null, account_number: null, bank_name: null, is_active: false, sort_order: 0 };
                              }
                              updated[pt.key] = { ...updated[pt.key], label: e.target.value || null };
                              setPaymentMethods(updated);
                            }}
                            placeholder={pt.label}
                            className="w-full px-3 py-2 bg-white rounded-xl text-sm border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none placeholder:text-gray-300"
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
                                className="w-24 h-24 object-contain rounded-lg border border-gray-200"
                              />
                            </div>
                          )}
                          <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium cursor-pointer active:scale-[0.98] transition-transform">
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
                                    const updated = { ...paymentMethods };
                                    if (!updated[pt.key]) {
                                      updated[pt.key] = { method_type: pt.key, label: null, qr_url: null, account_holder: null, account_number: null, bank_name: null, is_active: false, sort_order: 0 };
                                    }
                                    updated[pt.key] = { ...updated[pt.key], qr_url: data.url };
                                    setPaymentMethods(updated);
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
                              onClick={async () => {
                                if (!merchantId) return;
                                const updated = { ...paymentMethods };
                                if (updated[pt.key]) {
                                  updated[pt.key] = { ...updated[pt.key], qr_url: null };
                                }
                                setPaymentMethods(updated);
                              }}
                              className="block mt-1 text-xs text-red-500 font-medium active:opacity-70"
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
                              onChange={(e) => {
                                const updated = { ...paymentMethods };
                                if (!updated[pt.key]) {
                                  updated[pt.key] = { method_type: pt.key, label: null, qr_url: null, account_holder: null, account_number: null, bank_name: null, is_active: false, sort_order: 0 };
                                }
                                updated[pt.key] = { ...updated[pt.key], account_holder: e.target.value || null };
                                setPaymentMethods(updated);
                              }}
                              placeholder="e.g. Ram Shrestha"
                              className="w-full px-3 py-2 bg-white rounded-xl text-sm border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none placeholder:text-gray-300"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-[var(--color-text-muted)] mb-1">Account Number</label>
                            <input
                              type="text"
                              value={method?.account_number || ""}
                              onChange={(e) => {
                                const updated = { ...paymentMethods };
                                if (!updated[pt.key]) {
                                  updated[pt.key] = { method_type: pt.key, label: null, qr_url: null, account_holder: null, account_number: null, bank_name: null, is_active: false, sort_order: 0 };
                                }
                                updated[pt.key] = { ...updated[pt.key], account_number: e.target.value || null };
                                setPaymentMethods(updated);
                              }}
                              placeholder="e.g. 1234567890"
                              className="w-full px-3 py-2 bg-white rounded-xl text-sm border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none placeholder:text-gray-300"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-[var(--color-text-muted)] mb-1">Bank Name</label>
                            <input
                              type="text"
                              value={method?.bank_name || ""}
                              onChange={(e) => {
                                const updated = { ...paymentMethods };
                                if (!updated[pt.key]) {
                                  updated[pt.key] = { method_type: pt.key, label: null, qr_url: null, account_holder: null, account_number: null, bank_name: null, is_active: false, sort_order: 0 };
                                }
                                updated[pt.key] = { ...updated[pt.key], bank_name: e.target.value || null };
                                setPaymentMethods(updated);
                              }}
                              placeholder="e.g. NMB Bank"
                              className="w-full px-3 py-2 bg-white rounded-xl text-sm border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none placeholder:text-gray-300"
                            />
                          </div>
                        </>
                      )}

                      {/* Cash: no extra fields needed */}

                      {/* Save method */}
                      <button
                        onClick={async () => {
                          if (!merchantId) return;
                          setSavingPaymentMethod(pt.key);
                          try {
                            const m = paymentMethods[pt.key];
                            const result = await upsertMerchantPaymentMethod(merchantId, pt.key, {
                              label: m?.label || null,
                              qr_url: m?.qr_url || null,
                              account_holder: m?.account_holder || null,
                              account_number: m?.account_number || null,
                              bank_name: m?.bank_name || null,
                              is_active: m?.is_active ?? false,
                              sort_order: m?.sort_order ?? 0,
                            });
                            if (!result.success) {
                              throw new Error(result.error || "Failed to save payment method");
                            }
                            addToast(`${pt.label} saved!`, "success");
                          } catch (err: any) {
                            addToast(err.message || `Failed to save ${pt.label}`, "error");
                          } finally {
                            setSavingPaymentMethod(null);
                          }
                        }}
                        disabled={saving}
                        className="w-full py-2 bg-[var(--color-primary)] text-white rounded-xl text-sm font-medium active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {saving ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          "Save"
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-2">
            Customers will see enabled payment methods when making payments.
          </p>
        </section>

        {/* PIN Change Section */}
        <section>
          <h2 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
            PIN Security
          </h2>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-50 p-4">
            {!showPinChange ? (
              <button
                onClick={() => { setShowPinChange(true); setPinError(""); }}
                className="w-full py-2.5 bg-[var(--color-primary)] text-white rounded-xl text-sm font-semibold active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
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
                  <div className="bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg">{pinError}</div>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowPinChange(false); setPinError(""); setCurrentPin(["", "", "", ""]); setNewPin(["", "", "", ""]); setConfirmPin(["", "", "", ""]); }}
                    className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium active:scale-[0.98] transition-transform"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleChangePin}
                    disabled={changingPin}
                    className="flex-1 py-2.5 bg-[var(--color-primary)] text-white rounded-xl text-sm font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {changingPin ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
          <div className="space-y-2">
            <button
              onClick={() => handleExport("csv")}
              disabled={exporting}
              className="w-full flex items-center gap-3 p-4 bg-white rounded-2xl shadow-sm border border-gray-50 active:scale-[0.99] transition-transform disabled:opacity-50"
            >
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-green-600"
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
                <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              )}
            </button>
            <button
              onClick={() => handleExport("json")}
              disabled={exporting}
              className="w-full flex items-center gap-3 p-4 bg-white rounded-2xl shadow-sm border border-gray-50 active:scale-[0.99] transition-transform disabled:opacity-50"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-blue-600"
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
                <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              )}
            </button>
          </div>
        </section>

        {/* Reminder Settings Section */}
        <section>
          <h2 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
            Auto Reminder
          </h2>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-50 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--color-text)]">End-of-Month SMS Reminder</p>
                <p className="text-xs text-[var(--color-text-muted)]">Auto-send SMS to customers with balance</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={reminderSettings.auto_reminder_enabled}
                  onChange={(e) => setReminderSettings({ ...reminderSettings, auto_reminder_enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--color-primary)]" />
              </label>
            </div>

            {reminderSettings.auto_reminder_enabled && (
              <>
                <div>
                  <label className="block text-xs text-[var(--color-text-muted)] mb-1">Reminder Day of Month</label>
                  <select
                    value={reminderSettings.reminder_day_of_month}
                    onChange={(e) => setReminderSettings({ ...reminderSettings, reminder_day_of_month: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-white rounded-xl text-sm border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none"
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
                        setReminderSettings({ ...reminderSettings, reminder_message_template: e.target.value });
                      }
                    }}
                    maxLength={150}
                    rows={2}
                    className="w-full px-3 py-2 bg-white rounded-xl text-sm border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none resize-none"
                  />
                  <p className="text-xs text-[var(--color-text-muted)] text-right mt-1">
                    {reminderSettings.reminder_message_template.length}/150
                  </p>
                </div>

                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-[var(--color-text-muted)] mb-1">Preview:</p>
                  <p className="text-sm text-[var(--color-text)]">
                    {reminderSettings.reminder_message_template
                      .replace("{customer}", "Ram")
                      .replace("{balance}", "1,500")
                      .replace("{shop}", (merchantName || "Shop").split(" ")[0])
                    }
                  </p>
                </div>
              </>
            )}

            <button
              onClick={async () => {
                if (!merchantId) return;
                setSavingReminder(true);
                try {
                  await updateMerchantReminderSettings(merchantId, reminderSettings);
                  addToast("Reminder settings saved!", "success");
                } catch {
                  addToast("Failed to save reminder settings", "error");
                } finally {
                  setSavingReminder(false);
                }
              }}
              disabled={savingReminder}
              className="w-full py-2.5 bg-[var(--color-primary)] text-white rounded-xl text-sm font-semibold active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {savingReminder ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                "Save Reminder Settings"
              )}
            </button>
          </div>
        </section>

        {/* SMS Balance Section */}
        {smsBalance !== null && (
          <section>
            <h2 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
              SMS Credits
            </h2>
            <a
              href="/merchant/billing"
              className="block bg-white rounded-2xl shadow-sm border border-gray-50 p-4 active:scale-[0.99] transition-transform"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                      LOW
                    </span>
                  )}
                  <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </div>
            </a>
          </section>
        )}

        {/* Account Section */}
        <section>
          <h2 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
            Account
          </h2>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 p-4 bg-white rounded-2xl shadow-sm border border-gray-50 active:scale-[0.99] transition-transform"
          >
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-red-500"
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
              <p className="font-medium text-sm text-red-600">Sign Out</p>
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
          <div className="bg-white rounded-2xl shadow-sm border border-gray-50 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] flex items-center justify-center">
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
                  QR Hisab
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Version 1.0.0
                </p>
              </div>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
              Digital Credit Ledger for small retail shops in
              Nepal. Built to replace traditional Udharo registers with a modern,
              offline-first solution.
            </p>
          </div>
        </section>

        {/* QR Code Section */}
        {merchantId && merchantName && (
          <section>
            <h2 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
              Your Shop QR
            </h2>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-50 p-4">
              <QRDisplay
                merchantId={merchantId}
                merchantName={merchantName}
                businessType={businessType}
              />
              <p className="text-xs text-[var(--color-text-muted)] text-center mt-3">
                Customers scan this QR to submit credit requests
              </p>
            </div>
          </section>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
