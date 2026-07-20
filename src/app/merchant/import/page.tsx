"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentMerchantId } from "@/lib/auth";
import { getMerchantProfile } from "@/app/actions/merchant";
import { getMerchantSmsBalance } from "@/app/actions/sms-billing";
import { importCustomersAction, sendSmsChunkAction, ImportRow, SmsChunk } from "@/app/actions/import-customers";
import BottomNav from "@/components/BottomNav";
import { useToast } from "@/components/Toast";

interface ParsedRow {
  id: number;
  name: string;
  phone: string;
  amount: number;
  sendSms: boolean;
  valid: boolean;
  error?: string;
}

export default function ImportPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [merchantName, setMerchantName] = useState("");
  const [smsBalance, setSmsBalance] = useState(0);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; smsSent: number; smsFailed: number } | null>(null);

  const [phase, setPhase] = useState<"idle" | "db" | "sms" | "done">("idle");
  const [smsProgress, setSmsProgress] = useState({ sent: 0, failed: 0, total: 0 });

  const selectedSmsCount = rows.filter((r) => r.valid && r.sendSms).length;
  const smsExceedsBalance = selectedSmsCount > smsBalance;
  const hasValidRows = rows.some((r) => r.valid);

  useEffect(() => { (async () => {
    const id = await getCurrentMerchantId().catch(() => null);
    if (!id) {
      router.replace("/login");
      return;
    }
    setMerchantId(id);
    const profile = await getMerchantProfile(id);
    setMerchantName(profile?.name || "");
    const balance = await getMerchantSmsBalance(id).catch(() => 0);
    setSmsBalance(balance);
  })(); }, []);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setResult(null);

    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      let parsed: Record<string, string>[] = [];

      if (ext === "csv") {
        const text = await file.text();
        const Papa = await import("papaparse");
        const result = Papa.default.parse(text, { header: true, skipEmptyLines: true });
        parsed = result.data as Record<string, string>[];
      } else if (ext === "xlsx" || ext === "xls") {
        const buffer = await file.arrayBuffer();
        const XLSX = await import("xlsx");
        const wb = XLSX.read(buffer, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json<Record<string, string>>(ws);
        parsed = data;
      } else {
        addToast("Unsupported file format. Use .csv, .xlsx, or .xls", "error");
        setLoading(false);
        return;
      }

      const parsedRows: ParsedRow[] = parsed.map((item, idx) => {
        const name = (item.Name || item.name || item["Customer Name"] || "").trim();
        const phoneRaw = (item.Phone || item.phone || item["Phone Number"] || item.Mobile || "").trim();
        const amount = parseFloat(item.Balance || item.balance || item.Amount || item.amount || "0");
        const cleaned = phoneRaw.replace(/[\s\-\(\)]/g, "").replace(/^\+977/, "").slice(-10);
        const valid = !!name && /^9[876]\d{8}$/.test(cleaned) && amount > 0;
        return {
          id: idx,
          name,
          phone: phoneRaw,
          amount,
          sendSms: idx < 10 && valid,
          valid,
          error: valid ? undefined : name ? "Invalid phone or amount" : "Missing name",
        };
      });

      setRows(parsedRows);
    } catch (err) {
      addToast("Failed to parse file: " + (err instanceof Error ? err.message : String(err)), "error");
    } finally {
      setLoading(false);
    }
  };

  const toggleSms = (id: number) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, sendSms: !r.sendSms } : r))
    );
  };

  const handleImport = async () => {
    if (!merchantId || !hasValidRows || smsExceedsBalance) return;
    setImporting(true);
    setResult(null);

    const payload: ImportRow[] = rows
      .filter((r) => r.valid)
      .map((r) => ({
        name: r.name,
        phone: r.phone,
        amount: r.amount,
        sendSms: r.sendSms,
      }));

    // ── Phase A: DB import ──
    setPhase("db");
    const res = await importCustomersAction(merchantId, payload, merchantName);

    if (!res.success) {
      addToast(res.error || "Import failed", "error");
      setImporting(false);
      setPhase("idle");
      return;
    }

    setResult({ imported: res.imported, smsSent: 0, smsFailed: 0 });

    // ── Phase B: SMS dispatch with per-chunk progress ──
    if (res.smsChunks && res.smsChunks.length > 0) {
      setPhase("sms");
      setSmsProgress({ sent: 0, failed: 0, total: res.smsChunks.length });

      let totalSent = 0;
      let totalFailed = 0;

      for (let i = 0; i < res.smsChunks.length; i++) {
        const chunkResult = await sendSmsChunkAction(res.smsChunks[i]);
        totalSent += chunkResult.sent;
        totalFailed += chunkResult.failed;
        setSmsProgress((prev) => ({ ...prev, sent: totalSent, failed: totalFailed }));

        if (i < res.smsChunks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      setResult({ imported: res.imported, smsSent: totalSent, smsFailed: totalFailed });
    }

    setPhase("done");
    setImporting(false);

    addToast(
      `Imported ${res.imported} customers` +
      (res.smsChunks ? `, sent ${smsProgress.sent} SMS` + (smsProgress.failed > 0 ? `, ${smsProgress.failed} failed` : "") : ""),
      "success"
    );
  };

  const isProcessing = importing || phase === "db" || phase === "sms";

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-1">Import Customers</h1>
        <p className="text-sm text-gray-500 mb-4">
          SMS Balance: <span className="font-semibold text-blue-600">{smsBalance}</span> parts
        </p>

        {rows.length === 0 && !loading && (
          <div
            className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-blue-400 transition"
            onClick={() => fileInputRef.current?.click()}
          >
            <p className="text-gray-500 mb-2">Drop an Excel or CSV file here</p>
            <p className="text-xs text-gray-400">Supports .csv, .xlsx, .xls</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleFile}
            />
          </div>
        )}

        {loading && (
          <div className="text-center py-10">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
            <p className="text-gray-500">Parsing file...</p>
          </div>
        )}

        {rows.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">
                {rows.filter((r) => r.valid).length} valid rows · {selectedSmsCount} SMS selected
                {smsExceedsBalance && (
                  <span className="text-red-500 font-semibold ml-2">
                    Exceeds balance by {selectedSmsCount - smsBalance}
                  </span>
                )}
              </span>
              <button
                className="text-sm text-blue-600 underline"
                disabled={isProcessing}
                onClick={() => { setRows([]); setResult(null); }}
              >
                Clear
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm mb-4 max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="p-2 text-left">Name</th>
                    <th className="p-2 text-left">Phone</th>
                    <th className="p-2 text-right">Balance</th>
                    <th className="p-2 text-center">Send SMS</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-t border-gray-100">
                      <td className="p-2">
                        <span className={row.valid ? "" : "text-red-400"}>{row.name || "—"}</span>
                        {!row.valid && row.error && (
                          <span className="text-xs text-red-400 block">{row.error}</span>
                        )}
                      </td>
                      <td className="p-2 font-mono text-xs">{row.phone || "—"}</td>
                      <td className="p-2 text-right">{row.amount > 0 ? `Rs. ${row.amount.toFixed(2)}` : "—"}</td>
                      <td className="p-2 text-center">
                        <input
                          type="checkbox"
                          checked={row.sendSms}
                          disabled={!row.valid || isProcessing}
                          onChange={() => toggleSms(row.id)}
                          className="w-4 h-4 text-blue-600 cursor-pointer"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Progress indicator */}
            {phase === "db" && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm">
                <p className="font-semibold text-blue-700">Saving customers to database...</p>
                <div className="mt-2 h-2 bg-blue-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full animate-pulse w-full" />
                </div>
              </div>
            )}

            {phase === "sms" && (
              <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-xl text-sm">
                <p className="font-semibold text-purple-700">
                  Sending SMS: {smsProgress.sent + smsProgress.failed} of {smsProgress.total} batches completed
                </p>
                <p className="text-purple-600 text-xs mt-0.5">
                  {smsProgress.sent} sent · {smsProgress.failed} failed
                </p>
                <div className="mt-2 h-2 bg-purple-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full transition-all duration-300"
                    style={{ width: `${((smsProgress.sent + smsProgress.failed) / smsProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {phase === "done" && result && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl text-sm">
                <p className="font-semibold text-green-700">Import complete</p>
                <p className="text-green-600">
                  {result.imported} customers imported · {result.smsSent} SMS sent
                  {result.smsFailed > 0 && ` · ${result.smsFailed} SMS failed`}
                </p>
              </div>
            )}

            <button
              onClick={handleImport}
              disabled={!hasValidRows || smsExceedsBalance || isProcessing}
              className="w-full py-3 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
            >
              {phase === "db"
                ? "Saving to database..."
                : phase === "sms"
                  ? `Sending SMS (${smsProgress.sent + smsProgress.failed}/${smsProgress.total})...`
                  : phase === "done"
                    ? "Import Complete ✓"
                    : `Import ${rows.filter((r) => r.valid).length} Customers`}
            </button>
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
