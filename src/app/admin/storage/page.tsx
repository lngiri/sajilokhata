"use client";

import { useEffect, useState, useCallback } from "react";
import { getMerchantStorageUsage } from "@/app/actions/admin";

interface MerchantUsage {
  id: string;
  name: string;
  businessName: string;
  phone: string;
  transactionCount: number;
  customerCount: number;
  estimatedRows: number;
}

export default function StoragePage() {
  const [data, setData] = useState<MerchantUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<"transactionCount" | "customerCount" | "estimatedRows">("estimatedRows");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getMerchantStorageUsage();
    setData(result);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = data
    .filter((m) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        m.businessName.toLowerCase().includes(q) ||
        m.phone.includes(q)
      );
    })
    .sort((a, b) => {
      const mul = sortDir === "desc" ? -1 : 1;
      return (a[sortKey] - b[sortKey]) * mul;
    });

  const totalTx = data.reduce((s, m) => s + m.transactionCount, 0);
  const totalCust = data.reduce((s, m) => s + m.customerCount, 0);
  const totalRows = data.reduce((s, m) => s + m.estimatedRows, 0);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ col }: { col: typeof sortKey }) => (
    <span className="inline-block ml-1 text-gray-600">
      {sortKey === col ? (sortDir === "desc" ? "▼" : "▲") : "▽"}
    </span>
  );

  return (
    <div>
      <h1 className="text-xl font-bold text-white mb-1">Storage &amp; Usage</h1>
      <p className="text-sm text-gray-400 mb-6">
        Database row estimates per merchant
      </p>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <p className="text-2xl font-bold text-emerald-400">{totalTx.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">Total Transactions</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <p className="text-2xl font-bold text-blue-400">{totalCust.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">Total Customers</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <p className="text-2xl font-bold text-amber-400">{totalRows.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">Estimated Total Rows</p>
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
      ) : filtered.length === 0 ? (
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
                <th
                  className="text-right px-4 py-3 text-gray-400 font-medium cursor-pointer hover:text-white"
                  onClick={() => toggleSort("transactionCount")}
                >
                  Txns <SortIcon col="transactionCount" />
                </th>
                <th
                  className="text-right px-4 py-3 text-gray-400 font-medium cursor-pointer hover:text-white"
                  onClick={() => toggleSort("customerCount")}
                >
                  Customers <SortIcon col="customerCount" />
                </th>
                <th
                  className="text-right px-4 py-3 text-gray-400 font-medium cursor-pointer hover:text-white"
                  onClick={() => toggleSort("estimatedRows")}
                >
                  Est. Rows <SortIcon col="estimatedRows" />
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className="border-b border-gray-800/50 hover:bg-gray-900/30">
                  <td className="px-4 py-3 text-white">
                    <span className="font-medium">{m.businessName || m.name || "Unnamed"}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{m.phone}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{m.transactionCount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{m.customerCount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-semibold text-amber-400">{m.estimatedRows.toLocaleString()}</span>
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
