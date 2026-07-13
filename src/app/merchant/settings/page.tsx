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
import {
  getMerchantProfile,
  updateMerchantProfile,
  getMerchantCreditLogs,
} from "@/lib/actions";

export default function SettingsPage() {
  const { addToast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Merchant profile state
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [merchantName, setMerchantName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("kirana");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [authPhone, setAuthPhone] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const id = await getCurrentMerchantId();
      setMerchantId(id);

      // Pull phone from Supabase auth session (most authoritative)
      const sessionPhone = await getCurrentUserPhone();
      setAuthPhone(sessionPhone);

      if (id) {
        const profile = await getMerchantProfile(id);
        setMerchantName(profile.name || "");
        setBusinessName(profile.business_name || "");
        setBusinessType(profile.business_type || "kirana");
        setAddress(profile.address || "");
        // Auth session phone is most authoritative; fall back to db phone
        setPhone(sessionPhone || profile.phone || "");
      }
    } catch (err) {
      console.error("Failed to load merchant profile:", err);
    }
  };

  const handleSave = async () => {
    if (!merchantId) {
      addToast("Not logged in", "error");
      return;
    }

    setSaving(true);
    try {
      await updateMerchantProfile(merchantId, {
        name: merchantName.trim() || undefined,
        business_name: businessName.trim() || undefined,
        business_type: businessType,
        address: address.trim() || undefined,
        phone: phone || undefined,
      });
      addToast("तपाईंको प्रोफाइल विवरण सफलतापूर्वक अपडेट भयो।", "success");
    } catch (err: any) {
      console.error("Failed to save merchant profile:", err);
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
          new Date(log.created_at as string).toLocaleDateString(),
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
            {/* Shop Name */}
            <div className="p-4">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
                Shop Name
              </label>
              <input
                type="text"
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                placeholder="Enter shop name"
                className="w-full px-3.5 py-2.5 bg-white rounded-xl text-sm border border-gray-200 focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] outline-none transition-all placeholder:text-gray-300"
              />
            </div>

            {/* Business Name */}
            <div className="p-4">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
                Business Name (पसलको नाम)
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
              <div className="px-3.5 py-2.5 bg-gray-50 rounded-xl text-sm text-gray-500 capitalize border border-gray-100">
                {businessType || "Not set"}
              </div>
            </div>

            {/* Address */}
            <div className="p-4">
              <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
                Address (ठेगाना)
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
                Registered Business Phone (दर्ता फोन नम्बर)
              </label>
              <div className="px-3.5 py-2.5 bg-emerald-50 rounded-xl text-sm font-mono text-emerald-700 border border-emerald-100 flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>+977 {phone ? phone.replace(/^\+977/, "") : "Not registered"}</span>
              </div>
              {authPhone && authPhone !== phone && (
                <p className="text-xs text-[var(--color-text-muted)] mt-1.5 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  Auth phone: {authPhone} (login phone, may differ)
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
