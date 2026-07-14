"use client";

import { useEffect, useState, useCallback } from "react";
import { getAdminMerchants, toggleMerchantStatus } from "@/app/actions/admin";

interface Merchant {
  id: string;
  name: string;
  businessName: string;
  phone: string;
  status: string;
  transactionCount: number;
  createdAt: string;
}

export default function UsersPage() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    const data = await getAdminMerchants(q || undefined);
    setMerchants(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(""); }, [load]);

  const handleToggle = async (merchant: Merchant) => {
    setToggling(merchant.id);
    const result = await toggleMerchantStatus(merchant.id, merchant.status);
    if (result.success && result.newStatus) {
      setMerchants((prev) =>
        prev.map((m) => (m.id === merchant.id ? { ...m, status: result.newStatus! } : m))
      );
    }
    setToggling(null);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-50 tracking-tight mb-1">User Directory</h1>
      <p className="text-sm text-slate-400 mb-8">Manage all registered merchants</p>

      <div className="flex gap-3 mb-6">
        <input
          type="text"
          placeholder="Search by name, shop, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(search)}
          className="flex-1 px-4 py-2.5 bg-slate-800 text-slate-200 rounded-xl border border-slate-700 focus:ring-2 focus:ring-red-500/40 outline-none text-sm placeholder-slate-500"
        />
        <button onClick={() => load(search)} className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-sm font-medium transition-colors">
          Search
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : merchants.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <p className="text-sm font-medium">No merchants found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {merchants.map((m) => (
            <div key={m.id} className="rounded-xl border border-slate-700 bg-slate-800/50 shadow-lg p-5 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-slate-200 truncate">{m.businessName || m.name || "Unnamed"}</span>
                  <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
                    m.status === "suspended" ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"
                  }`}>
                    {m.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{m.phone} &middot; {m.transactionCount} txns</p>
              </div>
              <button
                onClick={() => handleToggle(m)}
                disabled={toggling === m.id}
                className={`shrink-0 px-4 py-2 text-xs font-semibold rounded-lg transition-all disabled:opacity-50 ${
                  m.status === "suspended"
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                    : "bg-red-600 hover:bg-red-500 text-white"
                }`}
              >
                {toggling === m.id ? (
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                ) : m.status === "suspended" ? "Activate" : "Suspend"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
