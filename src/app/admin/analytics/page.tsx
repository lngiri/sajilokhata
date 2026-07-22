"use client";

import { useEffect, useState, useMemo } from "react";
import { getMerchantAnalytics } from "@/app/actions/admin";

interface MerchantAnalytic {
  id: string;
  name: string;
  businessName: string;
  phone: string;
  transactionCount: number;
  customerCount: number;
  lastActiveDate: string | null;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<MerchantAnalytic[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    getMerchantAnalytics()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const sorted = useMemo(() => {
    const filtered = data.filter((m) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        m.businessName.toLowerCase().includes(q) ||
        m.phone.includes(q)
      );
    });
    return filtered.sort((a, b) => b.transactionCount - a.transactionCount);
  }, [data, search]);

  const totalTx = useMemo(() => data.reduce((s, m) => s + m.transactionCount, 0), [data]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--a-text)] tracking-tight mb-1">Usage Analytics</h1>
      <p className="text-sm text-[var(--a-muted)] mb-8">
        Merchant activity overview — sorted by transaction count
      </p>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-[var(--a-surface)] rounded-xl shadow-lg border border-[var(--a-border)] p-6">
          <p className="text-4xl font-bold tracking-tight text-[var(--color-primary-light)]">{data.length}</p>
          <p className="text-sm text-[var(--a-muted)] mt-2">Active Merchants</p>
        </div>
        <div className="bg-[var(--a-surface)] rounded-xl shadow-lg border border-[var(--a-border)] p-6">
          <p className="text-4xl font-bold tracking-tight text-blue-400">{totalTx.toLocaleString()}</p>
          <p className="text-sm text-[var(--a-muted)] mt-2">Total Transactions</p>
        </div>
        <div className="bg-[var(--a-surface)] rounded-xl shadow-lg border border-[var(--a-border)] p-6">
          <p className="text-4xl font-bold tracking-tight text-amber-400">
            {data.length > 0 ? Math.round(totalTx / data.length).toLocaleString() : "-"}
          </p>
          <p className="text-sm text-[var(--a-muted)] mt-2">Avg Txns / Merchant</p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, shop, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 bg-[var(--a-input)] text-[var(--a-input-text)] rounded-xl border border-[var(--a-border)] focus:ring-2 focus:ring-red-500/40 outline-none text-sm placeholder-[var(--a-muted)]"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16 text-[var(--a-muted)]">
          <p className="text-sm font-medium">No data found</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--a-border)] shadow-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--a-border)] bg-[var(--a-surface)]">
                <th className="text-left px-5 py-3.5 text-xs font-medium text-[var(--a-muted)] uppercase tracking-wider">Business</th>
                <th className="text-left px-5 py-3.5 text-xs font-medium text-[var(--a-muted)] uppercase tracking-wider">Phone</th>
                <th className="text-right px-5 py-3.5 text-xs font-medium text-[var(--a-muted)] uppercase tracking-wider">Transactions</th>
                <th className="text-right px-5 py-3.5 text-xs font-medium text-[var(--a-muted)] uppercase tracking-wider">Customers</th>
                <th className="text-right px-5 py-3.5 text-xs font-medium text-[var(--a-muted)] uppercase tracking-wider">Last Active</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((m, idx) => (
                <tr key={m.id} className={`border-b border-[var(--a-border)]/50 hover:bg-[var(--a-hover)] transition-colors ${idx % 2 === 1 ? "bg-[var(--a-stripe)]" : ""}`}>
                  <td className="px-5 py-3.5 text-sm font-medium text-[var(--a-text)]">
                    {m.businessName || m.name || "Unnamed"}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-[var(--a-muted)] font-mono">{m.phone}</td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="font-semibold text-[var(--color-primary-light)]">{m.transactionCount.toLocaleString()}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right text-[var(--a-text-2)]">{m.customerCount.toLocaleString()}</td>
                  <td className="px-5 py-3.5 text-right text-[var(--a-muted)] text-xs">
                    {m.lastActiveDate
                      ? new Date(m.lastActiveDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "\u2014"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
