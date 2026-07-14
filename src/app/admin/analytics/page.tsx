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
      <h1 className="text-2xl font-bold text-slate-50 tracking-tight mb-1">Usage Analytics</h1>
      <p className="text-sm text-slate-400 mb-8">
        Merchant activity overview — sorted by transaction count
      </p>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 p-6">
          <p className="text-4xl font-bold tracking-tight text-emerald-400">{data.length}</p>
          <p className="text-sm text-slate-400 mt-2">Active Merchants</p>
        </div>
        <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 p-6">
          <p className="text-4xl font-bold tracking-tight text-blue-400">{totalTx.toLocaleString()}</p>
          <p className="text-sm text-slate-400 mt-2">Total Transactions</p>
        </div>
        <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 p-6">
          <p className="text-4xl font-bold tracking-tight text-amber-400">
            {data.length > 0 ? Math.round(totalTx / data.length).toLocaleString() : "-"}
          </p>
          <p className="text-sm text-slate-400 mt-2">Avg Txns / Merchant</p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, shop, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 bg-slate-800 text-slate-200 rounded-xl border border-slate-700 focus:ring-2 focus:ring-red-500/40 outline-none text-sm placeholder-slate-500"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <p className="text-sm font-medium">No data found</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-700 shadow-lg">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800">
                <th className="text-left px-5 py-3.5 text-xs font-medium text-slate-400 uppercase tracking-wider">Business</th>
                <th className="text-left px-5 py-3.5 text-xs font-medium text-slate-400 uppercase tracking-wider">Phone</th>
                <th className="text-right px-5 py-3.5 text-xs font-medium text-slate-400 uppercase tracking-wider">Transactions</th>
                <th className="text-right px-5 py-3.5 text-xs font-medium text-slate-400 uppercase tracking-wider">Customers</th>
                <th className="text-right px-5 py-3.5 text-xs font-medium text-slate-400 uppercase tracking-wider">Last Active</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((m) => (
                <tr key={m.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                  <td className="px-5 py-3.5 text-sm font-medium text-slate-200">
                    {m.businessName || m.name || "Unnamed"}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-slate-500 font-mono">{m.phone}</td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="font-semibold text-emerald-400">{m.transactionCount.toLocaleString()}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right text-slate-300">{m.customerCount.toLocaleString()}</td>
                  <td className="px-5 py-3.5 text-right text-slate-500 text-xs">
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
