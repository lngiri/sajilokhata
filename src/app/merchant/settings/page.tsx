"use client";

import { useState, useEffect } from "react";
import BottomNav from "@/components/BottomNav";
import { useToast } from "@/components/Toast";
import { getCurrentMerchantId, signOut } from "@/lib/auth";
import { getMerchantProfile, getMerchantCreditLogs } from "@/lib/actions";

export default function SettingsPage() {
  const { addToast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [merchantName, setMerchantName] = useState("My Shop");
  const [businessType, setBusinessType] = useState("kirana");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const id = await getCurrentMerchantId();
      if (id) {
        const profile = await getMerchantProfile(id);
        setMerchantName(profile.name || "My Shop");
        setBusinessType(profile.business_type || "kirana");
        setPhone(profile.phone || "");
      }
    } catch {
      // Use defaults
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
        // Generate CSV
        const headers = ["Date", "Type", "Amount", "Status", "Description", "Customer"];
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
          ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `sajilo-khata-ledger-${new Date().toISOString().split("T")[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);

        addToast("CSV exported successfully!", "success");
      } else {
        // Generate JSON
        const jsonContent = JSON.stringify(logs, null, 2);
        const blob = new Blob([jsonContent], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `sajilo-khata-ledger-${new Date().toISOString().split("T")[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);

        addToast("JSON exported successfully!", "success");
      }
    } catch {
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
          <a href="/merchant/dashboard" className="mr-3 p-1 active:scale-95 transition-transform">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </a>
          <h1 className="text-lg font-bold text-[var(--color-text)]">Settings</h1>
        </div>
      </div>

      <div className="px-4 py-4 space-y-6">
        {/* Profile Section */}
        <section>
          <h2 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
            Shop Profile
          </h2>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-50 divide-y divide-gray-50">
            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--color-text)]">Shop Name</p>
                <p className="text-xs text-[var(--color-text-muted)]">{merchantName}</p>
              </div>
            </div>
            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--color-text)]">Business Type</p>
                <p className="text-xs text-[var(--color-text-muted)] capitalize">{businessType}</p>
              </div>
            </div>
            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--color-text)]">Phone</p>
                <p className="text-xs text-[var(--color-text-muted)]">{phone || "Not set"}</p>
              </div>
            </div>
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
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
              </div>
              <div className="text-left flex-1">
                <p className="font-medium text-sm text-[var(--color-text)]">Export as CSV</p>
                <p className="text-xs text-[var(--color-text-muted)]">Spreadsheet for accounting</p>
              </div>
              {exporting && <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />}
            </button>
            <button
              onClick={() => handleExport("json")}
              disabled={exporting}
              className="w-full flex items-center gap-3 p-4 bg-white rounded-2xl shadow-sm border border-gray-50 active:scale-[0.99] transition-transform disabled:opacity-50"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <div className="text-left flex-1">
                <p className="font-medium text-sm text-[var(--color-text)]">Export as JSON</p>
                <p className="text-xs text-[var(--color-text-muted)]">Raw data backup</p>
              </div>
              {exporting && <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />}
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
              <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
            </div>
            <div className="text-left">
              <p className="font-medium text-sm text-red-600">Sign Out</p>
              <p className="text-xs text-[var(--color-text-muted)]">Log out of your account</p>
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
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-[var(--color-text)]">Sajilo Khata</p>
                <p className="text-xs text-[var(--color-text-muted)]">Version 1.0.0</p>
              </div>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
              Digital Credit Ledger & Delivery Diary for small retail shops in Nepal.
              Built to replace traditional Udharo registers with a modern, offline-first solution.
            </p>
          </div>
        </section>
      </div>

      <BottomNav />
    </div>
  );
}
