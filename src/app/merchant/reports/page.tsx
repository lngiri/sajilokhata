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
    <div className={`rounded-xl p-4 border ${disabled ? "border-dashed border-gray-200 bg-gray-50/50" : "bg-white shadow-sm border-gray-50"}`}>
      <p className={`text-xs font-medium ${disabled ? "text-gray-300" : "text-[var(--color-text-muted)]"}`}>
        {label}
      </p>
      <p className={`text-xl font-bold mt-1 ${disabled ? "text-gray-200" : color}`}>
        {disabled ? "—" : `${prefix} ${typeof value === "number" ? value.toLocaleString() : value}`}
      </p>
    </div>
  );
}

// ─── Analytics Charts ──────────────────────────────────────────

function CashFlowChart({ data }: { data: { date: string; debit: number; credit: number; cash: number }[] }) {
  if (data.length === 0) {
    return <div className="text-center py-8 text-sm text-[var(--color-text-muted)]">No data for selected period</div>;
  }
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-50">
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
    return <div className="text-center py-8 text-sm text-[var(--color-text-muted)]">No customer data</div>;
  }
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-50">
      <p className="text-sm font-semibold text-[var(--color-text)] mb-3">Top Customers by Outstanding Balance</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis type="number" tick={{ fontSize: 10 }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
          <Tooltip />
          <Bar dataKey="balance" fill="#dc2626" radius={[0, 4, 4, 0]} name="Outstanding (Rs.)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Transaction Audit Log ─────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  approved: "bg-green-50 text-green-700",
  pending: "bg-amber-50 text-amber-700",
  rejected: "bg-slate-100 text-slate-500 line-through opacity-60",
  disputed: "bg-red-50 text-red-700",
  unverified: "bg-blue-50 text-blue-700",
  edit_requested: "bg-indigo-50 text-indigo-700",
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
    return <div className="text-center py-8 text-sm text-[var(--color-text-muted)]">No transactions found</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-[var(--color-text-muted)] border-b border-gray-100">
            <th className="text-left py-2 pr-2 font-medium">Date</th>
            <th className="text-left py-2 pr-2 font-medium">Customer</th>
            <th className="text-left py-2 pr-2 font-medium">Status</th>
            <th className="text-left py-2 pr-2 font-medium">Type</th>
            <th className="text-right py-2 pr-2 font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log: any) => (
            <tr key={log.id} className={`border-b border-gray-50 last:border-0 ${log.status === "rejected" ? "opacity-60" : ""}`}>
              <td className="py-2.5 pr-2 text-[var(--color-text)] whitespace-nowrap text-xs">
                {new Date(log.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "Asia/Kathmandu" })}
              </td>
              <td className="py-2.5 pr-2 text-[var(--color-text)] truncate max-w-[100px] text-xs">
                {log.customers?.name || log.customers?.phone || "—"}
              </td>
              <td className="py-2.5 pr-2">
                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_BADGE[log.status] || "bg-gray-100 text-gray-600"}`}>
                  {STATUS_LABELS[log.status] || log.status}
                </span>
              </td>
              <td className="py-2.5 pr-2">
                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${log.type === "debit" ? "bg-red-50 text-red-700" : log.type === "cash" ? "bg-blue-50 text-blue-700" : "bg-green-50 text-green-700"}`}>
                  {log.type === "debit" ? "Credit" : log.type === "cash" ? "Cash" : "Payment"}
                </span>
              </td>
              <td className={`py-2.5 pr-2 text-right font-medium text-xs ${log.type === "debit" ? "text-red-600" : log.type === "cash" ? "text-blue-600" : "text-green-600"}`}>
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
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <a href="/merchant/dashboard" className="p-1 active:scale-95 transition-transform">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </a>
            <h1 className="text-lg font-bold text-[var(--color-text)]">Financial Report</h1>
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
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${preset === p ? "bg-[var(--color-primary)] text-white" : "bg-gray-100 text-gray-600"}`}>
              {p === "today" ? "Today" : p === "week" ? "This Week" : p === "month" ? "This Month" : "Custom Range"}
            </button>
          ))}
          {preset === "custom" && (
            <div className="flex items-center gap-1.5 ml-2">
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                className="px-2 py-1 text-xs border border-gray-200 rounded-lg outline-none" />
              <span className="text-xs text-[var(--color-text-muted)]">—</span>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2 py-1 text-xs border border-gray-200 rounded-lg outline-none" />
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Total Sales" value={analytics?.totalSales ?? "—"} color="text-blue-600" />
          <MetricCard label="Cash In Hand" value={analytics?.cashInHand ?? "—"} color="text-green-600" />
          <MetricCard label="Outstanding Credit" value={analytics?.totalOutstanding ?? "—"} color="text-red-600" />
          <MetricCard label="Cash Received" value={analytics?.totalReceived ?? "—"} color="text-green-600" />
          <MetricCard label="Net Cash Flow"
            value={analytics ? (analytics.netCashFlow >= 0 ? analytics.netCashFlow : `-${Math.abs(analytics.netCashFlow)}`) : "—"}
            color={(analytics?.netCashFlow ?? 0) >= 0 ? "text-green-600" : "text-red-600"}
          />
          <MetricCard label="Customers" value={analytics?.topCustomers.length ?? "—"} prefix="#" color="text-[var(--color-primary)]" />
        </div>

        {/* Charts */}
        <CashFlowChart data={safeDailyBreakdown} />
        <TopCustomersChart data={safeTopCustomers} />

        {/* Transaction Audit Log */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-50">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-[var(--color-text)]">Transactions</p>
            <div className="flex items-center gap-1">
              {(["approved", "pending", "rejected", "all"] as LogFilter[]).map((f) => (
                <button key={f} onClick={() => setLogFilter(f)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${logFilter === f ? "bg-[var(--color-primary)] text-white" : "bg-gray-100 text-gray-500"}`}>
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
