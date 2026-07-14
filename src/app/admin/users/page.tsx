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
      <h1 className="text-xl font-bold text-white mb-1">User Directory</h1>
      <p className="text-sm text-gray-400 mb-6">Manage all registered merchants</p>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Search by name, shop, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(search)}
          className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-xl border border-gray-800 focus:ring-2 focus:ring-emerald-500/40 outline-none text-sm"
        />
        <button onClick={() => load(search)} className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm transition-colors">
          Search
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : merchants.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-sm">No merchants found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {merchants.map((m) => (
            <div key={m.id} className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-white truncate">{m.businessName || m.name || "Unnamed"}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    m.status === "suspended" ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"
                  }`}>
                    {m.status}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{m.phone} &middot; {m.transactionCount} txns</p>
              </div>
              <button
                onClick={() => handleToggle(m)}
                disabled={toggling === m.id}
                className={`shrink-0 px-3 py-1.5 text-xs rounded-lg font-medium transition-colors disabled:opacity-50 ${
                  m.status === "suspended"
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                    : "bg-red-600 hover:bg-red-500 text-white"
                }`}
              >
                {toggling === m.id ? (
                  <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin mx-auto" />
                ) : m.status === "suspended" ? "Activate" : "Suspend"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
