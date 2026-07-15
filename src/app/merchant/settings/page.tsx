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
} from "@/app/actions/merchant";
import { changePin } from "@/app/actions/pin";

export default function SettingsPage() {
  const { addToast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Merchant profile state
  const [loading, setLoading] = useState(true);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [merchantName, setMerchantName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("kirana");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [authPhone, setAuthPhone] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

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
      const id = await getCurrentMerchantId();
      setMerchantId(id);

      const sessionPhone = await getCurrentUserPhone();
      setAuthPhone(sessionPhone);

      if (id) {
        const profile = await getMerchantProfile(id);
        setMerchantName(profile.name || "");
        setBusinessName(profile.business_name || "");
        setBusinessType(profile.business_type || "kirana");
        setAddress(profile.address || "");
        setPhone(profile.phone || "");
        setPhotoUrl(profile.photo_url || null);
      }
    } catch (err) {
      console.error("Failed to load merchant profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const displayPhone = phone || authPhone || "";

  const handleSave = async () => {
    if (!merchantId) {
      console.warn("[Settings] handleSave — merchantId is null/undefined");
      addToast("Not logged in", "error");
      return;
    }

    console.log("[Settings] handleSave — merchantId:", merchantId);
    setSaving(true);
    try {
      await updateMerchantProfile(merchantId, {
        name: merchantName.trim() || undefined,
        business_name: businessName.trim() || undefined,
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
                      capture="environment"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !merchantId) return;
                        setPhotoUploading(true);
                        try {
                          const formData = new FormData();
                          formData.append("file", file);
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
            {/* Shop Name (read-only) */}
            <div className="p-4">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
                Shop Name
              </label>
              {loading ? (
                <div className="px-3.5 py-2.5 bg-gray-50 rounded-xl">
                  <div className="h-5 w-40 bg-gray-200 rounded animate-pulse" />
                </div>
              ) : (
                <div className="px-3.5 py-2.5 bg-gray-50 rounded-xl text-sm text-gray-700 border border-gray-100 flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                  <span>{merchantName || "No name set"}</span>
                </div>
              )}
            </div>

            {/* Business Name */}
            <div className="p-4">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
                Business Name
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="e.g. Giri Kirana Store"
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
                  <span>+977 {displayPhone.replace(/^\+977/, "")}</span>
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
            disabled={saving}
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
              Digital Credit Ledger & Delivery Diary for small retail shops in
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
