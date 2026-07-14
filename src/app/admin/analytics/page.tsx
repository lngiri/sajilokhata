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
      <h1 className="text-xl font-bold text-white mb-1">Usage Analytics</h1>
      <p className="text-sm text-gray-400 mb-6">
        Merchant activity overview — sorted by transaction count
      </p>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <p className="text-2xl font-bold text-emerald-400">{data.length}</p>
          <p className="text-xs text-gray-400 mt-1">Active Merchants</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <p className="text-2xl font-bold text-blue-400">{totalTx.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">Total Transactions</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <p className="text-2xl font-bold text-amber-400">
            {data.length > 0 ? Math.round(totalTx / data.length).toLocaleString() : "-"}
          </p>
          <p className="text-xs text-gray-400 mt-1">Avg Txns / Merchant</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Search by name, shop, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-xl border border-gray-800 focus:ring-2 focus:ring-emerald-500/40 outline-none text-sm"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-sm">No data found</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900">
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Business</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Phone</th>
                <th className="text-right px-4 py-3 text-gray-400 font-medium">Transactions</th>
                <th className="text-right px-4 py-3 text-gray-400 font-medium">Customers</th>
                <th className="text-right px-4 py-3 text-gray-400 font-medium">Last Active</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((m) => (
                <tr key={m.id} className="border-b border-gray-800/50 hover:bg-gray-900/30">
                  <td className="px-4 py-3 text-white font-medium">
                    {m.businessName || m.name || "Unnamed"}
                  </td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{m.phone}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-semibold text-emerald-400">{m.transactionCount.toLocaleString()}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">{m.customerCount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-gray-400 text-xs">
                    {m.lastActiveDate
                      ? new Date(m.lastActiveDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "—"}
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
