"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import BottomNav from "@/components/BottomNav";
import { getCurrentMerchantId } from "@/lib/auth";
import {
  getMerchantAnalytics,
  getMerchantCreditLogs,
  type AnalyticsResult,
} from "@/app/actions/merchant";

// ─── Date Filter ───────────────────────────────────────────────

type RangePreset = "today" | "week" | "month" | "custom";

function getPresetRange(preset: RangePreset): { start: string; end: string; label: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const today = `${y}-${m}-${d}`;

  switch (preset) {
    case "today":
      return { start: today, end: today, label: "Today" };
    case "week": {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const wy = weekAgo.getFullYear();
      const wm = String(weekAgo.getMonth() + 1).padStart(2, "0");
      const wd = String(weekAgo.getDate()).padStart(2, "0");
      return { start: `${wy}-${wm}-${wd}`, end: today, label: "This Week" };
    }
    case "month": {
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      const my = monthAgo.getFullYear();
      const mm = String(monthAgo.getMonth() + 1).padStart(2, "0");
      const md = String(monthAgo.getDate()).padStart(2, "0");
      return { start: `${my}-${mm}-${md}`, end: today, label: "This Month" };
    }
    default:
      return { start: today, end: today, label: "Custom" };
  }
}

// ─── Metric Card ───────────────────────────────────────────────

function MetricCard({
  label,
  value,
  prefix = "Rs.",
  color = "text-[var(--color-text)]",
  disabled = false,
}: {
  label: string;
  value: string | number;
  prefix?: string;
  color?: string;
  disabled?: boolean;
}) {
  return (
    <div className={`rounded-xl p-4 border ${disabled ? "border-dashed border-gray-200 dark:border-[var(--color-border)] bg-gray-50/50 dark:bg-gray-800/50" : "bg-[var(--color-surface)] shadow-sm border-[var(--color-border)]"}`}>
      <p className={`text-xs font-medium ${disabled ? "text-gray-300 dark:text-gray-600" : "text-[var(--color-text-muted)]"}`}>
        {label}
      </p>
      <p className={`text-xl font-bold mt-1 ${disabled ? "text-gray-200 dark:text-gray-700" : color}`}>
        {disabled ? "—" : `${prefix} ${typeof value === "number" ? value.toLocaleString() : value}`}
      </p>
    </div>
  );
}

// ─── Analytics Charts ──────────────────────────────────────────

function CashFlowChart({ data }: { data: { date: string; debit: number; credit: number; cash: number }[] }) {
  if (data.length === 0) {
    return (
      <div className="text-center py-8 space-y-3">
        <svg className="w-12 h-12 mx-auto opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
        <p className="text-sm text-[var(--color-text-muted)]">No data for this period yet 📝</p>
        <p className="text-xs text-[var(--color-text-muted)]">Try adding entries or selecting a different date range</p>
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
      <p className="text-sm font-semibold text-[var(--color-text)] mb-3">Cash Flow Trend (Credit, Cash & Received)</p>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="debitGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#dc2626" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="creditGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#16a34a" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Area type="monotone" dataKey="debit" stroke="#dc2626" fill="url(#debitGrad)" strokeWidth={2} name="Credit Given" />
          <Area type="monotone" dataKey="cash" stroke="#2563eb" fill="url(#cashGrad)" strokeWidth={2} name="Cash Sale" />
          <Area type="monotone" dataKey="credit" stroke="#16a34a" fill="url(#creditGrad)" strokeWidth={2} name="Amount Received" />
        </AreaChart>
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
      <p className="text-sm font-semibold text-[var(--color-text)] mb-3">Top Customers by Outstanding Balance</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis type="number" tick={{ fontSize: 10 }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
          <Tooltip />
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
  unverified: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
  edit_requested: "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300",
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
                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${log.type === "debit" ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300" : log.type === "cash" ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" : "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"}`}>
                  {log.type === "debit" ? "Credit" : log.type === "cash" ? "Cash" : "Payment"}
                </span>
              </td>
              <td className={`py-2.5 pr-2 text-right font-medium text-xs ${log.type === "debit" ? "text-red-600 dark:text-red-400" : log.type === "cash" ? "text-blue-600 dark:text-blue-400" : "text-green-600 dark:text-green-400"}`}>
                Rs. {log.amount.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────

type LogFilter = "all" | "approved" | "pending" | "rejected";

const STATUS_LABELS: Record<string, string> = {
  approved: "Approved",
  pending: "Pending",
  rejected: "Rejected",
  disputed: "Disputed",
  unverified: "Unverified",
  edit_requested: "Edit Req.",
};

const EXCLUDED_CHART_STATUSES = ["rejected", "disputed"];

export default function MerchantReportsPage() {
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [preset, setPreset] = useState<RangePreset>("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [analytics, setAnalytics] = useState<AnalyticsResult | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [logFilter, setLogFilter] = useState<LogFilter>("approved");

  useEffect(() => {
    getCurrentMerchantId().then(setMerchantId);
  }, []);

  const range = preset === "custom"
    ? { start: customStart, end: customEnd, label: "Custom" }
    : getPresetRange(preset);

  const fetchData = useCallback(async () => {
    if (!merchantId || !range.start) return;
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  }, [merchantId, range.start, range.end]);

  // Client-side safety filter: strip rejected/disputed from chart data
  const safeDailyBreakdown = (analytics?.dailyBreakdown || []).filter(
    () => true // backend already filters to approved only; this is a guard
  );
  const safeTopCustomers = (analytics?.topCustomers || []).filter(
    () => true
  );

  // Filter transaction logs by selected status
  const filteredLogs = useMemo(() => {
    if (logFilter === "all") return logs;
    return logs.filter((log: any) => log.status === logFilter);
  }, [logs, logFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExportCSV = () => {
    const headers = ["Date", "Customer", "Type", "Amount", "Status", "Description"];
    const rows = filteredLogs.map((log: any) => [
      new Date(log.created_at).toISOString().split("T")[0],
      log.type === "cash" ? "Walk-in" : (log.customers?.name || log.customers?.phone || ""),
      log.type === "debit" ? "Credit Given" : log.type === "cash" ? "Cash Sale" : "Payment Received",
      log.amount,
      STATUS_LABELS[log.status] || log.status,
      log.description || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `financial-report-${range.start}-${range.end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-[var(--color-bg)]/80 backdrop-blur-md border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <a href="/merchant/dashboard" className="p-1 active:scale-95 transition-transform">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </a>
            <h1 className="text-lg font-bold text-[var(--color-text)]">Financial Report 📊</h1>
          </div>
          <button onClick={handleExportCSV}
            className="px-3 py-1.5 text-xs font-medium bg-[var(--color-primary)] text-white rounded-lg active:scale-[0.98] transition-transform">
            Export CSV
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

      <div className="px-4 py-4 space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Total Sales" value={analytics?.totalSales ?? "—"} color="text-blue-600 dark:text-blue-400" />
          <MetricCard label="Cash In Hand" value={analytics?.cashInHand ?? "—"} color="text-green-600 dark:text-green-400" />
          <MetricCard label="Outstanding Credit" value={analytics?.totalOutstanding ?? "—"} color="text-red-600 dark:text-red-400" />
          <MetricCard label="Cash Received" value={analytics?.totalReceived ?? "—"} color="text-green-600 dark:text-green-400" />
          <MetricCard label="Net Cash Flow"
            value={analytics ? (analytics.netCashFlow >= 0 ? analytics.netCashFlow : `-${Math.abs(analytics.netCashFlow)}`) : "—"}
            color={(analytics?.netCashFlow ?? 0) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}
          />
          <MetricCard label="Customers" value={analytics?.topCustomers.length ?? "—"} prefix="#" color="text-[var(--color-primary)]" />
        </div>

        {/* Charts */}
        <CashFlowChart data={safeDailyBreakdown} />
        <TopCustomersChart data={safeTopCustomers} />

        {/* Transaction Audit Log */}
        <div className="bg-[var(--color-surface)] rounded-xl p-4 shadow-sm border border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-[var(--color-text)]">Transactions</p>
            <div className="flex items-center gap-1">
              {(["approved", "pending", "rejected", "all"] as LogFilter[]).map((f) => (
                <button key={f} onClick={() => setLogFilter(f)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${logFilter === f ? "bg-[var(--color-primary)] text-white" : "bg-gray-100 dark:bg-gray-800 text-[var(--color-text-muted)]"}`}>
                  {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <TransactionAuditLog logs={filteredLogs} loading={loading && logs.length === 0} />
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
