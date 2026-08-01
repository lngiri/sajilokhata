"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import BottomNav from "@/components/BottomNav";
import PullToRefresh from "@/components/PullToRefresh";
import { useToast } from "@/components/Toast";
import { playSuccessSound } from "@/lib/sound";
import { getCurrentMerchantId } from "@/lib/auth";
import {
  getMerchantAnalytics,
  getMerchantCreditLogs,
  type AnalyticsResult,
} from "@/app/actions/merchant";
import { formatNumber } from "@/lib/format";

// ─── Date Filter ───────────────────────────────────────────────

type RangePreset = "today" | "week" | "month" | "custom";

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getPresetRange(preset: Exclude<RangePreset, "custom">): { start: string; end: string; label: string } {
  const now = new Date();
  const today = toDateStr(now);

  switch (preset) {
    case "today":
      return { start: today, end: today, label: "Today" };
    case "week": {
      // Local Monday–Sunday of the current week
      const day = now.getDay(); // 0 = Sunday
      const monday = new Date(now);
      monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { start: toDateStr(monday), end: toDateStr(sunday), label: "This Week" };
    }
    case "month":
      return {
        start: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
        end: today,
        label: "This Month",
      };
    default:
      return { start: today, end: today, label: "" };
  }
}

// ─── Metric Card ───────────────────────────────────────────────

function MetricCard({
  label,
  value,
  prefix = "Rs.",
  color = "text-[var(--color-text)]",
  hint,
}: {
  label: string;
  value: string | number;
  prefix?: string;
  color?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl p-4 bg-[var(--color-surface)] shadow-sm border border-[var(--color-border)]">
      <p className="text-xs font-medium text-[var(--color-text-muted)]">{label}</p>
      <p className={`text-xl font-bold mt-1 ${color}`}>
        {prefix} {typeof value === "number" ? formatNumber(value) : value}
      </p>
      {hint && <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{hint}</p>}
    </div>
  );
}

// ─── Analytics Charts ──────────────────────────────────────────

function ExpenseChart({ data }: { data: { date: string; expense: number }[] }) {
  if (data.length === 0 || !data.some((d) => d.expense > 0)) {
    return null;
  }
  return (
    <div className="bg-[var(--color-surface)] rounded-xl p-4 shadow-sm border border-[var(--color-border)]">
      <p className="text-sm font-semibold text-[var(--color-text)] mb-3">Expense Trend 📉</p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data}>
          <defs>
            <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f97316" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#fb923c" stopOpacity={0.3} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip formatter={(value) => [`Rs. ${formatNumber(value)}`, "Expenses"]} />
          <Bar dataKey="expense" fill="url(#expenseGrad)" radius={[4, 4, 0, 0]} name="Expenses" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CashFlowChart({ data }: { data: { date: string; debit: number; credit: number; cash: number; cash_in: number; expense: number }[] }) {
  if (data.length === 0) {
    return null;
  }
  return (
    <div className="bg-[var(--color-surface)] rounded-xl p-4 shadow-sm border border-[var(--color-border)]">
      <p className="text-sm font-semibold text-[var(--color-text)] mb-3">Cash Flow Trend</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip formatter={(value, name) => [`Rs. ${formatNumber(value)}`, name]} />
          <Bar dataKey="debit" stackId="flow" fill="#dc2626" name="Credit Given" />
          <Bar dataKey="credit" stackId="flow" fill="#16a34a" name="Received" />
          <Bar dataKey="cash" stackId="flow" fill="#2563eb" name="Cash Sales" />
          <Bar dataKey="cash_in" stackId="flow" fill="#0d9488" name="Cash In" />
          <Bar dataKey="expense" stackId="flow" fill="#f97316" radius={[3, 3, 0, 0]} name="Expenses" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function TopCustomersChart({ data }: { data: { name: string; balance: number }[] }) {
  if (data.length === 0) {
    return (
      <div className="text-center py-8 space-y-3">
        <svg className="w-12 h-12 mx-auto opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
        <p className="text-sm text-[var(--color-text-muted)]">No customer data yet 👥</p>
        <p className="text-xs text-[var(--color-text-muted)]">Customer insights will appear here once you have entries</p>
        <a href="/merchant/scan" className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-xl text-sm font-medium active:scale-[0.98] transition-transform">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Entry
        </a>
      </div>
    );
  }
  return (
    <div className="bg-[var(--color-surface)] rounded-xl p-4 shadow-sm border border-[var(--color-border)]">
      <p className="text-sm font-semibold text-[var(--color-text)] mb-1">Top Customers by Outstanding Balance</p>
      <p className="text-[10px] text-[var(--color-text-muted)] mb-3">All-time balances — not limited to the selected range</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis type="number" tick={{ fontSize: 10 }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
          <Tooltip formatter={(value) => [`Rs. ${formatNumber(value)}`, "Outstanding"]} />
          <Bar dataKey="balance" fill="#dc2626" radius={[0, 4, 4, 0]} name="Outstanding" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Transaction Audit Log ─────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  approved: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300",
  pending: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
  rejected: "bg-slate-100 dark:bg-gray-700 text-slate-500 dark:text-slate-400 line-through opacity-60",
  disputed: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
  awaiting_confirmation: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
  edit_requested: "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300",
};

const STATUS_LABELS: Record<string, string> = {
  approved: "Approved",
  pending: "Pending",
  rejected: "Rejected",
  disputed: "Disputed",
  awaiting_confirmation: "Pending",
  edit_requested: "Edit Req.",
};

const TYPE_LABELS: Record<string, string> = {
  debit: "Credit Given",
  credit: "Payment Received",
  cash: "Cash Sale",
  cash_in: "Cash In",
  expense: "Expense",
};

function TransactionAuditLog({
  logs,
  loading,
}: {
  logs: any[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (logs.length === 0) {
    return (
      <div className="text-center py-8 space-y-3">
        <svg className="w-12 h-12 mx-auto opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        <p className="text-sm text-[var(--color-text-muted)]">No transactions found 📋</p>
        <p className="text-xs text-[var(--color-text-muted)]">Transactions will show up once you create entries</p>
        <a href="/merchant/scan" className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-xl text-sm font-medium active:scale-[0.98] transition-transform">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Entry
        </a>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
            <th className="text-left py-2 pr-2 font-medium">Date</th>
            <th className="text-left py-2 pr-2 font-medium">Customer</th>
            <th className="text-left py-2 pr-2 font-medium">Status</th>
            <th className="text-left py-2 pr-2 font-medium">Type</th>
            <th className="text-right py-2 pr-2 font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log: any) => (
            <tr key={log.id} className={`border-b border-[var(--color-border)] last:border-0 ${log.status === "rejected" ? "opacity-60" : ""}`}>
              <td className="py-2.5 pr-2 text-[var(--color-text)] whitespace-nowrap text-xs">
                {new Date(log.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "Asia/Kathmandu" })}
              </td>
              <td className="py-2.5 pr-2 text-[var(--color-text)] truncate max-w-[100px] text-xs">
                {log.customers?.name || log.customers?.phone || "—"}
              </td>
              <td className="py-2.5 pr-2">
                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_BADGE[log.status] || "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"}`}>
                  {STATUS_LABELS[log.status] || log.status}
                </span>
              </td>
              <td className="py-2.5 pr-2">
                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${log.type === "debit" ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300" : log.type === "expense" ? "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300" : log.type === "cash" ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" : log.type === "cash_in" ? "bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300" : "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"}`}>
                  {TYPE_LABELS[log.type] || log.type}
                </span>
              </td>
              <td className={`py-2.5 pr-2 text-right font-medium text-xs ${log.type === "debit" ? "text-red-600 dark:text-red-400" : log.type === "expense" ? "text-orange-600 dark:text-orange-400" : log.type === "cash" ? "text-blue-600 dark:text-blue-400" : log.type === "cash_in" ? "text-teal-600 dark:text-teal-400" : "text-green-600 dark:text-green-400"}`}>
                Rs. {formatNumber(log.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── CSV Export helpers ────────────────────────────────────────

/** Quote a CSV cell and escape embedded quotes/commas/newlines. */
function csvCell(value: string | number): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Neutralize spreadsheet formula injection (=, +, -, @, tab). */
function csvSafe(value: string | number): string {
  const s = String(value ?? "");
  return /^[=+\-@\t]/.test(s) ? `'${s}` : s;
}

/** Format a log date as YYYY-MM-DD in Nepal's timezone. */
function logDate(createdAt: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Kathmandu",
  }).formatToParts(new Date(createdAt));
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  return `${map.year}-${map.month}-${map.day}`;
}

// ─── Main Page ─────────────────────────────────────────────────

type LogFilter = "all" | "approved" | "awaiting_confirmation" | "rejected";

const EMPTY_STATE_ICON = (
  <svg className="w-12 h-12 mx-auto opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>
);

export default function MerchantReportsPage() {
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [preset, setPreset] = useState<RangePreset>("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [analytics, setAnalytics] = useState<AnalyticsResult | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logFilter, setLogFilter] = useState<LogFilter>("approved");
  const [exporting, setExporting] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    getCurrentMerchantId().then(setMerchantId);
  }, []);

  const range = useMemo(() => {
    if (preset === "custom") return { start: customStart, end: customEnd, label: "Custom" };
    return getPresetRange(preset);
  }, [preset, customStart, customEnd]);

  const customIncomplete = preset === "custom" && (!customStart || !customEnd);

  const fetchData = useCallback(async () => {
    if (!merchantId) return;
    if (customIncomplete) {
      setAnalytics(null);
      setLogs([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [a, l] = await Promise.all([
        getMerchantAnalytics(merchantId, range.start, range.end),
        getMerchantCreditLogs(merchantId, {
          limit: 50,
          dateFrom: range.start,
          dateTo: range.end,
        }),
      ]);
      setAnalytics(a);
      setLogs(l);
    } catch (err) {
      console.error("Failed to load report data:", err);
      setError("Couldn't load your report. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [merchantId, range.start, range.end, customIncomplete]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter transaction logs by selected status
  const filteredLogs = useMemo(() => {
    if (logFilter === "all") return logs;
    return logs.filter((log: any) => log.status === logFilter);
  }, [logs, logFilter]);

  const handleExportCSV = async () => {
    if (exporting || !merchantId || !range.start || !range.end) return;
    setExporting(true);
    try {
      // Export the full selected range across all statuses, not just the visible filter
      const all = await getMerchantCreditLogs(merchantId, {
        limit: 1000,
        dateFrom: range.start,
        dateTo: range.end,
      });
      const headers = ["Date", "Type", "Description", "Customer Name", "Customer Phone", "Amount", "Status"];
      const rows = all.map((log: any) => [
        logDate(log.created_at),
        TYPE_LABELS[log.type] || log.type,
        log.description || "",
        log.type === "cash" || log.type === "cash_in" ? "" : (log.customers?.name || ""),
        log.type === "cash" || log.type === "cash_in" ? "" : (log.customers?.phone || ""),
        log.amount,
        STATUS_LABELS[log.status] || log.status,
      ].map(csvSafe));
      const csv = "\uFEFF" + [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv; charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `financial-report-${range.start}-${range.end}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      playSuccessSound();
      addToast(`Exported ${all.length} transactions`, "success");
    } catch (err) {
      console.error("Export failed:", err);
      addToast("Export failed. Please try again.", "error");
    } finally {
      setExporting(false);
    }
  };

  const showContent = !customIncomplete;

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[var(--color-bg)]/80 backdrop-blur-md border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <a href="/merchant/dashboard" aria-label="Back to dashboard" className="p-1 active:scale-95 transition-transform">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </a>
            <h1 className="text-lg font-bold text-[var(--color-text)]">Financial Report 📊</h1>
          </div>
          <button onClick={handleExportCSV} disabled={exporting || !showContent}
            className="px-3 py-1.5 text-xs font-medium bg-[var(--color-primary)] text-white rounded-lg active:scale-[0.98] transition-transform disabled:opacity-50">
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-1.5 px-4 pb-3 overflow-x-auto">
          {(["today", "week", "month", "custom"] as RangePreset[]).map((p) => (
            <button key={p} onClick={() => setPreset(p)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${preset === p ? "bg-[var(--color-primary)] text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"}`}>
              {p === "today" ? "Today" : p === "week" ? "This Week" : p === "month" ? "This Month" : "Custom Range"}
            </button>
          ))}
          {preset === "custom" && (
            <div className="flex items-center gap-1.5 ml-2">
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded-lg outline-none dark:bg-gray-800 dark:text-white" />
              <span className="text-xs text-[var(--color-text-muted)]">—</span>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded-lg outline-none dark:bg-gray-800 dark:text-white" />
            </div>
          )}
        </div>
      </div>

      {!showContent ? (
        <div className="px-4 py-16 text-center space-y-3">
          {EMPTY_STATE_ICON}
          <p className="text-sm text-[var(--color-text-muted)]">Pick a start and end date</p>
          <p className="text-xs text-[var(--color-text-muted)]">The report will update automatically once both dates are selected</p>
        </div>
      ) : (
        <PullToRefresh onRefresh={fetchData}>
          <div className="px-4 py-4 space-y-4">
            {error && (
              <div className="flex items-center justify-between gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                <button onClick={fetchData}
                  className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg active:scale-[0.98] transition-transform whitespace-nowrap">
                  Retry
                </button>
              </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="Total Sales (range)" value={analytics?.totalSales ?? "—"} color="text-blue-600 dark:text-blue-400" />
              <MetricCard label="Outstanding Balance" value={analytics?.outstandingBalance ?? "—"} color="text-red-600 dark:text-red-400" hint="All-time, not limited to range" />
              <MetricCard label="Credit Given (range)" value={analytics?.totalOutstanding ?? "—"} color="text-red-600 dark:text-red-400" />
              <MetricCard label="Received (range)" value={analytics?.totalReceived ?? "—"} color="text-green-600 dark:text-green-400" />
              <MetricCard label="Cash Sales (range)" value={analytics?.totalCashSales ?? "—"} color="text-blue-600 dark:text-blue-400" />
              <MetricCard label="Cash In (range)" value={analytics?.totalCashIn ?? "—"} color="text-teal-600 dark:text-teal-400" />
              <MetricCard label="Expenses (range)" value={analytics?.totalExpenses ?? "—"} color="text-orange-600 dark:text-orange-400" />
              <MetricCard label="Net Cash Flow (range)"
                value={analytics ? (analytics.netCashFlow >= 0 ? analytics.netCashFlow : `-${Math.abs(analytics.netCashFlow)}`) : "—"}
                color={(analytics?.netCashFlow ?? 0) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}
              />
            </div>

            {/* Charts */}
            <ExpenseChart data={analytics?.dailyBreakdown || []} />
            <CashFlowChart data={analytics?.dailyBreakdown || []} />
            <TopCustomersChart data={analytics?.topCustomers || []} />

            {/* Transaction Audit Log */}
            <div className="bg-[var(--color-surface)] rounded-xl p-4 shadow-sm border border-[var(--color-border)]">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-[var(--color-text)]">Transactions</p>
                <div className="flex items-center gap-1">
                  {(["approved", "awaiting_confirmation", "rejected", "all"] as LogFilter[]).map((f) => (
                    <button key={f} onClick={() => setLogFilter(f)}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${logFilter === f ? "bg-[var(--color-primary)] text-white" : "bg-gray-100 dark:bg-gray-800 text-[var(--color-text-muted)]"}`}>
                      {f === "all" ? "All" : STATUS_LABELS[f] || (f.charAt(0).toUpperCase() + f.slice(1))}
                    </button>
                  ))}
                </div>
              </div>
              <TransactionAuditLog logs={filteredLogs} loading={loading && logs.length === 0} />
            </div>
          </div>
        </PullToRefresh>
      )}

      <BottomNav />
    </div>
  );
}
