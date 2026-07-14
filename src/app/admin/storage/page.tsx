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
    <span className="inline-block ml-1.5 text-[var(--a-muted)]">
      {sortKey === col ? (sortDir === "desc" ? "\u25BC" : "\u25B2") : "\u25BD"}
    </span>
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--a-text)] tracking-tight mb-1">Storage &amp; Usage</h1>
      <p className="text-sm text-[var(--a-muted)] mb-8">
        Database row estimates per merchant
      </p>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-[var(--a-surface)] rounded-xl shadow-lg border border-[var(--a-border)] p-6">
          <p className="text-4xl font-bold tracking-tight text-emerald-400">{totalTx.toLocaleString()}</p>
          <p className="text-sm text-[var(--a-muted)] mt-2">Total Transactions</p>
        </div>
        <div className="bg-[var(--a-surface)] rounded-xl shadow-lg border border-[var(--a-border)] p-6">
          <p className="text-4xl font-bold tracking-tight text-blue-400">{totalCust.toLocaleString()}</p>
          <p className="text-sm text-[var(--a-muted)] mt-2">Total Customers</p>
        </div>
        <div className="bg-[var(--a-surface)] rounded-xl shadow-lg border border-[var(--a-border)] p-6">
          <p className="text-4xl font-bold tracking-tight text-amber-400">{totalRows.toLocaleString()}</p>
          <p className="text-sm text-[var(--a-muted)] mt-2">Estimated Total Rows</p>
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
      ) : filtered.length === 0 ? (
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
                <th
                  className="text-right px-5 py-3.5 text-xs font-medium text-[var(--a-muted)] uppercase tracking-wider cursor-pointer hover:text-[var(--a-text)]"
                  onClick={() => toggleSort("transactionCount")}
                >
                  Txns <SortIcon col="transactionCount" />
                </th>
                <th
                  className="text-right px-5 py-3.5 text-xs font-medium text-[var(--a-muted)] uppercase tracking-wider cursor-pointer hover:text-[var(--a-text)]"
                  onClick={() => toggleSort("customerCount")}
                >
                  Customers <SortIcon col="customerCount" />
                </th>
                <th
                  className="text-right px-5 py-3.5 text-xs font-medium text-[var(--a-muted)] uppercase tracking-wider cursor-pointer hover:text-[var(--a-text)]"
                  onClick={() => toggleSort("estimatedRows")}
                >
                  Est. Rows <SortIcon col="estimatedRows" />
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, idx) => (
                <tr key={m.id} className={`border-b border-[var(--a-border)]/50 hover:bg-[var(--a-hover)] transition-colors ${idx % 2 === 1 ? "bg-[var(--a-stripe)]" : ""}`}>
                  <td className="px-5 py-3.5 text-sm font-medium text-[var(--a-text)]">
                    {m.businessName || m.name || "Unnamed"}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-[var(--a-muted)] font-mono">{m.phone}</td>
                  <td className="px-5 py-3.5 text-right text-[var(--a-text-2)]">{m.transactionCount.toLocaleString()}</td>
                  <td className="px-5 py-3.5 text-right text-[var(--a-text-2)]">{m.customerCount.toLocaleString()}</td>
                  <td className="px-5 py-3.5 text-right">
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
