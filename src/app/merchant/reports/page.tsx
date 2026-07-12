"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import BottomNav from "@/components/BottomNav";
import { getCurrentMerchantId } from "@/lib/auth";
import {
  getMerchantAnalytics,
  getMerchantCreditLogs,
  type AnalyticsResult,
} from "@/lib/actions";

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
      return { start: today, end: today, label: "आज (Today)" };
    case "week": {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const wy = weekAgo.getFullYear();
      const wm = String(weekAgo.getMonth() + 1).padStart(2, "0");
      const wd = String(weekAgo.getDate()).padStart(2, "0");
      return { start: `${wy}-${wm}-${wd}`, end: today, label: "यो हप्ता (This Week)" };
    }
    case "month": {
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      const my = monthAgo.getFullYear();
      const mm = String(monthAgo.getMonth() + 1).padStart(2, "0");
      const md = String(monthAgo.getDate()).padStart(2, "0");
      return { start: `${my}-${mm}-${md}`, end: today, label: "यो महिना (This Month)" };
    }
    default:
      return { start: today, end: today, label: "Custom" };
  }
}

// ─── Metric Card ───────────────────────────────────────────────

function MetricCard({
  label,
  value,
  prefix = "NPR",
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

function CashFlowChart({ data }: { data: { date: string; debit: number; credit: number }[] }) {
  if (data.length === 0) {
    return <div className="text-center py-8 text-sm text-[var(--color-text-muted)]">No data for selected period</div>;
  }
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-50">
      <p className="text-sm font-semibold text-[var(--color-text)] mb-3">Cash Flow Trend (Credit Given vs Received)</p>
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
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip />
          <Area type="monotone" dataKey="debit" stroke="#dc2626" fill="url(#debitGrad)" strokeWidth={2} name="Credit Given" />
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
          <Bar dataKey="balance" fill="#dc2626" radius={[0, 4, 4, 0]} name="Outstanding (NPR)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Transaction Audit Log ─────────────────────────────────────

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
            <th className="text-left py-2 pr-2 font-medium">Type</th>
            <th className="text-right py-2 pr-2 font-medium">Amount</th>
            <th className="text-right py-2 pr-2 font-medium text-gray-300">Qty {/* future: inventory */}</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log: any) => (
            <tr key={log.id} className="border-b border-gray-50 last:border-0">
              <td className="py-2.5 pr-2 text-[var(--color-text)] whitespace-nowrap">
                {new Date(log.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </td>
              <td className="py-2.5 pr-2 text-[var(--color-text)] truncate max-w-[120px]">
                {log.customers?.name || log.customers?.phone || "—"}
              </td>
              <td className="py-2.5 pr-2">
                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${log.type === "debit" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                  {log.type === "debit" ? "Credit" : "Payment"}
                </span>
              </td>
              <td className={`py-2.5 pr-2 text-right font-medium ${log.type === "debit" ? "text-red-600" : "text-green-600"}`}>
                NPR {log.amount.toLocaleString()}
              </td>
              <td className="py-2.5 text-right text-gray-300">—</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────

export default function MerchantReportsPage() {
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [preset, setPreset] = useState<RangePreset>("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [analytics, setAnalytics] = useState<AnalyticsResult | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExportCSV = () => {
    const headers = ["Date", "Customer", "Type", "Amount", "Description"];
    const rows = logs.map((log: any) => [
      new Date(log.created_at).toISOString().split("T")[0],
      log.customers?.name || log.customers?.phone || "",
      log.type === "debit" ? "Credit Given" : "Payment Received",
      log.amount,
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
            <h1 className="text-lg font-bold text-[var(--color-text)]">व्यापारिक प्रतिवेदन (Financial Report)</h1>
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
          <MetricCard label="कुल बाँकी उधारो (Outstanding Credit)" value={analytics?.totalOutstanding ?? "—"} color="text-red-600" />
          <MetricCard label="कुल उठेको नगद (Cash Received)" value={analytics?.totalReceived ?? "—"} color="text-green-600" />
          <MetricCard
            label="खुद कारोबार (Net Cash Flow)"
            value={analytics ? (analytics.netCashFlow >= 0 ? analytics.netCashFlow : `-${Math.abs(analytics.netCashFlow)}`) : "—"}
            color={(analytics?.netCashFlow ?? 0) >= 0 ? "text-green-600" : "text-red-600"}
          />
          <MetricCard label="ग्राहकहरू (Customers)" value={analytics?.topCustomers.length ?? "—"} prefix="#" color="text-[var(--color-primary)]" />
          {/* Future placeholders */}
          <MetricCard label="सकल नाफा (Gross Profit)" value={0} disabled />
          <MetricCard label="लागत (COGS)" value={0} disabled />
        </div>

        {/* Charts */}
        <CashFlowChart data={analytics?.dailyBreakdown || []} />
        <TopCustomersChart data={analytics?.topCustomers || []} />

        {/* Transaction Audit Log */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-50">
          <p className="text-sm font-semibold text-[var(--color-text)] mb-3">Transaction Log</p>
          <TransactionAuditLog logs={logs} loading={loading && logs.length === 0} />
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
